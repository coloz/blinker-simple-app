import { TestBed, inject } from '@angular/core/testing';

import { DeviceManagerService } from './device-manager.service';

describe('DeviceManagerService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DeviceManagerService]
    });
  });

  it('should be created', inject([DeviceManagerService], (service: DeviceManagerService) => {
    expect(service).toBeTruthy();
  }));
});
