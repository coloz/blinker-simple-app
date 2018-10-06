# blinker-simple-app  
本项目是blinker app端的单设备版本  
支持蓝牙Ble、WiFi设备连接  
使用ionic4 + angular6开发  
需配合设备端blinker库使用  
本项目仅供学习，不提供任何技术支持   
## 使用方法：  
```
$ npm i ionic cordova -g  
$ cd blinker-simple-app  
$ npm i  
```

android：
```
$ ionic cordova build android  
```
ios:
```
$ ionic cordova build ios  
```

## 配置方法：  
在src/home中变量device负责存储设备信息，其形式如下：  
```json
  device = {
    "type": "DiyArduino",
    "name": "D43639DF71A3",
    "config": {
      "mode": "ble",
      "customName": "blinker DIY device",
    },
    "data": {
      "state": "",
      "counter": 0
    }
  }
```
可修改配置如下：  
**type**根据设备类型选填:DiyArduino\DiyLiunx  
**name**填写设备mac地址(去掉冒号)  
**mode**根据接入方式选填:ble\net  




