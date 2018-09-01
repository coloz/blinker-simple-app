import { Injectable } from '@angular/core';
import { BLE } from '@ionic-native/ble';
import { Zeroconf } from '@ionic-native/zeroconf';
import { Diagnostic } from '@ionic-native/diagnostic';
import { Platform, Events } from '@ionic/angular';
import { TextDecoder } from 'text-encoding';

@Injectable({
  providedIn: 'root'
})
export class DeviceManagerService {
  uuid;
  bleUUID = "";
  brokers;
  devices;
  // device
  timer = [];
  userUrl: string;
  deviceList = [];
  lanDeviceList = [];
  bleDeviceList = [];
  mqttCloseCnt = 0;

  mqttClient;
  wsClient;

  constructor(
    private zeroconf: Zeroconf,
    private plt: Platform,
    private events: Events,
    private ble: BLE,
    private diagnostic: Diagnostic,
  ) {

  }


  init() {
  }

  connectDeviceTimer;
  connectDevice(device: any, mode: string = "show"): Promise<boolean> {
    return new Promise<boolean>(async (resolve, reject) => {
      if (!this.plt.is('cordova')) return resolve(false);
      //连接超时6秒。移除连接定时器情况：1.连接成功；2.退出页面
      this.connectDeviceTimer = window.setTimeout(() => {
        if (mode == "show") this.events.publish("provider:notice", 'timeoutConnect');
        this.disconnectDevice(device);
        return resolve(false);
      }, 6000);
      if (device.data.state != "disconnected") device.data.state = "disconnected";
      // this.events.publish("device:" + device.name, JSON.parse(`{"state":"disconnected"}`));
      if (device.config.mode == "ble") {
        if (!this.isBluetoothAvailable()) return resolve(false);
        if (mode == "show") this.events.publish("loading:show", 'connect');
        let result = await this.connectBleDevice(device)
        return resolve(result);
      } else if (device.config.mode == "net") {
        if (!this.isWifiAvailable()) return resolve(false);
        // if (!(await this.wifiIsConnected())) return resolve(false);
        if (mode == "show") this.events.publish("loading:show", 'connect');
        return resolve(await this.connectNetDevice(device));
      }
    })
  }

  disconnectDevice(device) {
    if (!this.plt.is('cordova')) return;
    //清除连接定时器
    window.clearTimeout(this.connectDeviceTimer);
    if (device.config.mode == "ble") {
      this.disconnectBleDevice(device);
    } else if (device.config.mode == "net") {
      this.disconnectNetDevice(device);
    }
  }

  //搜索并连接到指定net设备
  //zeroconf.close的情况:1.连接成功；2.连接超时；3.还未连接即退出layout页面
  // keepalivedInterval;
  async connectNetDevice(device): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      if (this.plt.is('android')) {
        this.zeroconf.watchAddressFamily = 'ipv4';
      }
      this.zeroconf.watch('_' + device.deviceType + '._tcp.', 'local.').subscribe(result => {
        if (result.action == "resolved") {
          if (result.service.name == device.name && result.service.ipv4Addresses.length > 0) {
            window.clearTimeout(this.connectDeviceTimer);
            this.zeroconf.close();
            this.events.publish("loading:hide", 'hide');
            this.disconnectNetDevice(device);
            this.wsClient = new WebSocket("ws://" + result.service.ipv4Addresses[0] + ":81");
            this.wsClient.onmessage = (event) => {
              // this.lastGetTime = new Date().getTime();
              let message = {};
              message["fromDevice"] = device.name;
              try {
                message["data"] = JSON.parse(event.data);
              }
              catch (e) {
                message["data"] = event.data;
              }
              this.processMessage(message);
            }
            this.wsClient.onopen = (event) => {
              console.log("ws open");
              console.log(event);
              // this.lastGetTime = new Date().getTime();
              // window.clearInterval(this.keepalivedInterval);
              // this.keepalivedInterval = window.setInterval(() => {
              //   this.queryWsDevice(device);
              // }, 3000)
              return resolve(true);
            };
            this.wsClient.onerror = (event) => {
              console.log("ws error");
              console.log(event);
            }
            this.wsClient.onclose = (event) => {
              console.log("ws close");
              console.log(event);
              this.events.publish("device:" + device.name, JSON.parse(`{"state":"disconnected"}`));
            }
            // return resolve(true);
          }
        }
      });
    })
  }

  disconnectNetDevice(device) {
    // console.log('guanguangguan');
    if (typeof (this.wsClient) != "undefined")
      this.wsClient.close();
    // this.wsClient.
    //处理还未连接上，便退出layout的情况  
    this.zeroconf.close();
  }

  //发送net数据
  send2net(device, message: string) {
    // if (this.wsClient.readyState == "OPEN") 
    // console.log("发送getstate");
    this.wsClient.send(message);
  }

  send(device, message: string) {
    if (device.config.mode == 'net') {
      this.send2net(device, message)
    } else {
      this.send2ble(device, message)
    }

  }


  //搜索并连接到指定ble设备
  lastbuf = new Uint8Array(10240);
  lastbufcnt = 0;
  connectBleDevice(device): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      //this.events.publish("loading:show", 'connect');
      // console.log("ble disconnect");log
      this.ble.disconnect(this.bleUUID);
      console.log("scanBle");
      this.ble.startScan([]).subscribe(result => {
        console.log(result);
        if (this.plt.is('android') || (typeof (result.advertising.kCBAdvDataManufacturerData) != 'undefined')) {
          // if (name2Mac(device.name) == this.mac2name(result)) {
          if (device.name == this.mac2name(result)) {
            console.log('连接蓝牙设备：' + result.id)
            window.clearTimeout(this.connectDeviceTimer);
            this.ble.connect(result.id).subscribe(
              data => {
                this.ble.stopScan();
                this.bleUUID = result.id;
                console.log(data);
                this.events.publish("loading:hide", 'hide');
                this.events.publish("device:" + device.name, JSON.parse(`{"state":"connected"}`));
                this.lastbuf.fill(0);
                this.lastbufcnt = 0;
                this.ble.startNotification(result.id, 'ffe0', 'ffe1').subscribe(buffer => {
                  let buftmp = new Uint8Array(buffer);
                  this.lastbuf.set(buftmp, this.lastbufcnt);
                  this.lastbufcnt += buftmp.length;
                  while (this.lastbuf.indexOf(10) > -1) {//找到/n，转字符串后测试是否能转json
                    let index = this.lastbuf.indexOf(10);
                    let fullMessage = transcoding(this.lastbuf);
                    console.log(fullMessage);
                    let message = {};
                    message["fromDevice"] = device.name;
                    if (fullMessage.indexOf('{') > -1) {
                      try {
                        message["data"] = JSON.parse(fullMessage);
                      }
                      catch (e) {
                        message["data"] = fullMessage;
                      }
                    }
                    else message["data"] = fullMessage;
                    this.processMessage(message);
                    let slicetmp = this.lastbuf.slice(index + 1, this.lastbufcnt);
                    this.lastbuf.fill(0);
                    this.lastbuf.set(slicetmp);
                    this.lastbufcnt -= index + 1;
                  }
                });
                return resolve(true);
              },
              error => {
                this.bleUUID = "";
                if (device.data.state != "disconnected") device.data.state = "disconnected";
                // this.events.publish("device:" + device.name, JSON.parse(`{"state":"disconnected"}`));
                console.log(error);
                return resolve(false);
              }
            );
          }
        }
      });
    })
  }

  async disconnectBleDevice(device) {
    this.ble.stopScan();
    this.ble.stopStateNotifications();
    // window.setTimeout(() => {
    // if (await this.ble.isConnected(this.bleUUID)) {
    console.log("ble disconnect");
    this.ble.disconnect(this.bleUUID);
    if (device.data.state != "disconnected") device.data.state = "disconnected";
    // this.events.publish("device:" + device.name, JSON.parse(`{"state":"disconnected"}`));
    this.bleUUID = "";
    //清空缓存
    this.lastbuf.fill(0);
  }

  //发送ble数据
  lastSendTime = 0;
  send2ble(device, message: string) {
    if (this.plt.is('android')) {
      let t = this.lastSendTime - new Date().getTime();
      this.lastSendTime = new Date().getTime();
      if (t < 0) t = 0;
      let i = 0;
      for (i = 0; i < message.length; i += 20) {
        let tmp = message.slice(i, i + 20);
        let delay = i + t;
        setTimeout(() => {
          this.ble.writeWithoutResponse(this.bleUUID, 'ffe0', 'ffe1', str2ab(tmp))
        }, delay);
      }
      this.lastSendTime = this.lastSendTime + i + t;
    }
    else {
      this.ble.writeWithoutResponse(this.bleUUID, 'ffe0', 'ffe1', str2ab(message))
    }


  }


  //将消息分发到组件上
  processMessage(message) {
    // window.clearTimeout(this.timer[message.fromDevice]);
    // console.log('将消息分发到组件:' + message.fromDevice)
    // 如果该fromDevice，不在现有设备列表中，则可能是刚添加的新设备
    if (this.deviceList.indexOf(message.fromDevice) > -1) {
      this.events.publish('device:' + message.fromDevice, message.data);
    }
    if (JSON.stringify(message.data) == '{"message":"Registration successful"}') {
      this.events.publish('device:new', message);
    }
  }

  mac2name(result) {
    let name = "";
    //android
    if (this.plt.is('android')) {
      name = result.id.replace(new RegExp(':', 'g'), '');
    }
    //ios
    else {
      let macBytes = new Uint8Array(result.advertising.kCBAdvDataManufacturerData);
      for (let i = macBytes.length - 6; i < macBytes.length; i++) {
        if (macBytes[i] <= 16) name += '0';
        name += macBytes[i].toString(16);
      }
    }
    return name.toUpperCase();
  }

  async isBluetoothAvailable() {
    if (await this.diagnostic.getBluetoothState() == this.diagnostic.bluetoothState.POWERED_ON) {
      return true;
    } else {
      this.events.publish("provider:notice", "openBluetooth");
      return false;
    }
  }

  async isWifiAvailable() {
    if (await this.diagnostic.isWifiAvailable()) {
      return true;
    } else {
      this.events.publish("provider:notice", "openWifi");
      return false;
    }
  }
}


export function transcoding(buf) {
  let message;
  if (checkCodeUtf8(buf))
    message = new TextDecoder("utf8").decode(new Uint8Array(buf.slice(0, buf.indexOf(10))));
  else
    message = new TextDecoder("gb18030").decode(new Uint8Array(buf.slice(0, buf.indexOf(10))));
  return message;
}

export function checkCodeUtf8(lastbuf): any {
  let index = lastbuf.indexOf(10);
  let utf8cnt = 0;
  let gb18030cnt = 0;
  let asciicnt = 0;
  for (let i = 0; i < index; i++) {//判断是否utf8编码
    if (lastbuf[i] < 0x80) {
      asciicnt++;
      continue;
    }
    else {
      let p = i;
      switch (lastbuf[p] >> 3) {
        case 31://1111 0xxx四字节utf8检测
          p++;
          if ((lastbuf[p] > 0xbf) || (lastbuf[p] < 0x80)) break;
        case 29://1110 xxxx三字节utf8检测
        case 28:
          p++;
          if ((lastbuf[p] > 0xbf) || (lastbuf[p] < 0x80)) break;
        case 27://110x xxxx两字节utf8检测
        case 26:
        case 25:
        case 24:
          p++;
          if ((lastbuf[p] > 0xbf) || (lastbuf[p] < 0x80)) break;//10xx xxxx
          utf8cnt++;
          i = p;
          break;
        default:
          break;
      }
    }
  }
  let utf8scale = utf8cnt * 3 / (index - asciicnt);
  if (utf8scale > 0.99) return true;
  for (let i = 0; i < index; i++) {
    if (lastbuf[i] < 0x80) {
      continue;
    }
    else {
      let p = i;
      if ((lastbuf[p] >= 0x81) && (lastbuf[p] <= 0xfe)) {//判断gb18030第一字节
        p++;
        if ((lastbuf[p] >= 0x40) && (lastbuf[p] <= 0xfe)) {//判断gb18030第二字节
          if (lastbuf[p] != 0x7f) {
            gb18030cnt++;
            i = p;
          }
        }
        else if ((lastbuf[p] >= 0x30) && (lastbuf[p] <= 0x39)) {//判断gb18030第二字节
          p++;
          if ((lastbuf[p] >= 0x81) && (lastbuf[p] <= 0xfe)) {//判断gb18030第三字节
            p++;
            if ((lastbuf[p] >= 0x30) && (lastbuf[p] <= 0x39)) {//判断gb18030第四字节
              gb18030cnt++;
              i = p;
            }
          }
        }
      }
    }
  }
  let gb18030scale = gb18030cnt * 2 / (index - asciicnt);
  if (utf8scale >= gb18030scale) return true;
  else return false;
}

export function str2ab(str) {
  var buf = new ArrayBuffer(str.length);
  var bufView = new Uint8Array(buf);
  for (var i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}
