import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from "homebridge";

let hap: HAP;

module.exports = (api: API) => {
    hap = api.hap;
    api.registerAccessory("Sensibo", Sensibo);
};

class Sensibo implements AccessoryPlugin {

    private readonly log: Logging;
    private readonly name: string;
    private readonly api: API;

    private readonly apiKey: string;
    private readonly id: string;
    
    private active = hap.Characteristic.Active.ACTIVE;
    private currentHeaterCoolerState = hap.Characteristic.CurrentHeaterCoolerState.INACTIVE; // COOLING, HEATING
    private targetHeaterCoolerState = hap.Characteristic.TargetHeaterCoolerState.COOL; // HEAT
    private targetTemperature: number = 20;

    private readonly heaterCoolerService: Service;
    private readonly informationService: Service;

    constructor(log: Logging, config: AccessoryConfig, api: API) {
        this.log = log;
        this.name = config.name;
        this.api = api;

        this.apiKey = config.apiKey;
        this.id = config.id;

        this.informationService = new this.api.hap.Service.AccessoryInformation()
            .setCharacteristic(this.api.hap.Characteristic.Manufacturer, "Custom Manufacturer")
            .setCharacteristic(this.api.hap.Characteristic.Model, "Custom Model");

        this.active = false;

        this.heaterCoolerService = new this.api.hap.Service.HeaterCooler(this.name);
        this.heaterCoolerService.getCharacteristic(this.api.hap.Characteristic.Active)
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                log.info("Current state of AC was returned: " + (this.active ? "ON" : "OFF"));
                callback(undefined, this.active);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                this.active = value as boolean;
                log.info("Current state of AC was set: " + (this.active ? "ON" : "OFF"));
                callback();
            });

        this.heaterCoolerService.getCharacteristic(this.api.hap.Characteristic.CurrentTemperature)
            .setProps({
                minValue: -100,
                maxValue: 100,
                minStep: 0.1
            })
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                var temp = 0;
                callback(null, temp)
            });

        this.heaterCoolerService.getCharacteristic(this.api.hap.Characteristic.CurrentHeaterCoolerState)
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                log.info("Current mode of AC was returned: " + (this.currentHeaterCoolerState == this.api.hap.Characteristic.CurrentHeaterCoolerState.INACTIVE ? "Inactive" : "~"));
                callback(null, this.currentHeaterCoolerState)
            });

        this.heaterCoolerService.getCharacteristic(this.api.hap.Characteristic.TargetHeaterCoolerState)
            .setProps({
                validValues: [
                    this.api.hap.Characteristic.TargetHeaterCoolerState.COOL,
                    this.api.hap.Characteristic.TargetHeaterCoolerState.HEAT
                ]
            })
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                log.info("Target mode of AC was returned: " + (this.targetHeaterCoolerState == this.api.hap.Characteristic.TargetHeaterCoolerState.COOL ? "COOL" : "HEAT"));
                callback(null, this.targetHeaterCoolerState)
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                this.targetHeaterCoolerState = value;
                log.info("Target mode of AC was set: " + (this.targetHeaterCoolerState == this.api.hap.Characteristic.TargetHeaterCoolerState.COOL ? "COOL" : "HEAT"));
                callback()
            });

        this.heaterCoolerService.getCharacteristic(this.api.hap.Characteristic.CoolingThresholdTemperature)
            .setProps({
                minValue: 18,
                maxValue: 32,
                minStep: 1
            })
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                log.info("Cooling threshold of AC was returned: " + this.targetTemperature);
                callback(undefined, this.targetTemperature)
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                this.targetTemperature = value as number;
                log.info("Cooling threshold of AC was set: " + this.targetTemperature);
                callback()
            });

        this.heaterCoolerService.getCharacteristic(this.api.hap.Characteristic.HeatingThresholdTemperature)
            .setProps({
                minValue: 10,
                maxValue: 30,
                minStep: 1
            })
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                log.info("Heating threshold of AC was returned: " + this.targetTemperature);
                callback(undefined, this.targetTemperature)
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                this.targetTemperature = value as number;
                log.info("Heating threshold of AC was set: " + this.targetTemperature);
                callback()
            });

        log.info("AC finished initializing!");
    }

    /*
     * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
     * Typical this only ever happens at the pairing process.
     */
    identify(): void {
        this.log("Identify!");
    }

    /*
     * This method is called directly after creation of this instance.
     * It should return all services which should be added to the accessory.
     */
    getServices(): Service[] {
        return [
            this.informationService,
            this.heaterCoolerService,
        ];
    }
}
