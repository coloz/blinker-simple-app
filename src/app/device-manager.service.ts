import { Injectable } from '@angular/core';
import { BLE } from '@ionic-native/ble';

@Injectable({
  providedIn: 'root'
})
export class DeviceManagerService {

  constructor(
    private ble: BLE
  ) { 


    
  }
}
