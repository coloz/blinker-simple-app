import { Component, ChangeDetectorRef } from '@angular/core';
import { DeviceManagerService } from '../device-manager.service'
import { Events } from '@ionic/angular';
@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {

  // type根据设备类型选填:DiyArduino\DiyLiunx
  // name填写设备mac地址(去掉冒号)
  // mode根据接入方式选填:ble\net

  device = {
    type: 'DiyArduino',
    name: 'xxxxxxxxxxxxxxx',
    config: {
      mode: 'ble',
      customName: 'blinker DIY device',
    },
    data: {
      state: '',
      counter: 0
    }
  }
  constructor(
    private events: Events,
    private changeDetectorRef: ChangeDetectorRef,
    private deviceManager: DeviceManagerService
  ) { }

  ngOnInit() {
    
    // this.deviceManager.connectDevice(this.device);
  }

  tap1() {
    this.deviceManager.send(this.device, `{"btn-123":"tap"}`)
  }

  tap2() {
    this.deviceManager.send(this.device, `{"btn-abc":"tap"}`)
  }

  subscribe() {
    this.events.subscribe('device:' + this.device.name, data => {
      // console.log("分发数据");
      // console.log(data);
      //如果不是json对象，就判定为unknownData
      if (typeof (data) == 'string' || typeof (data) == "number") {
        this.events.publish(this.device.name + ':unknownData', data.toString() + "\n");
      } else {
        for (let key in data) {
          //保留关键字不允许用户改写
          if (key == "config" || key == "name" || key == "device")
            break;
          //实际通信数据存储
          //device.data为临时数据存储位置
          this.device.data[key] = data[key];
          this.events.publish(this.device.name + ':' + key, 'loaded');
        }
        // 显示到degbug窗口
        this.events.publish(this.device.name + ':unknownData', JSON.stringify(data) + "\n");
      }
      //通知相关页面,关闭读取状态
      this.events.publish('page:device', 'loaded')
      this.changeDetectorRef.markForCheck();
    });
  }

}
