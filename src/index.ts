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
    private readonly apiKey: string;
    private readonly id: string;
    private active = false;

    private readonly heaterCoolerService: Service;
    private readonly informationService: Service;

    constructor(log: Logging, config: AccessoryConfig, api: API) {
        this.log = log;
        this.name = config.name;

        this.apiKey = config.apiKey;
        this.id = config.id;

        this.informationService = new hap.Service.AccessoryInformation()
            .setCharacteristic(hap.Characteristic.Manufacturer, "Custom Manufacturer")
            .setCharacteristic(hap.Characteristic.Model, "Custom Model");

        this.active = false;

        this.heaterCoolerService = new hap.Service.HeaterCooler(this.name);
        this.heaterCoolerService.getCharacteristic(hap.Characteristic.Active)
            .on('get', (callback) => {
                log.info("Current state of AC was returned: " + (this.active ? "ON" : "OFF"));
                callback(undefined, this.active);
            })
            .on('set', (value, callback) => {
                this.active = value;
                log.info("Current state of AC was set: " + (this.switchOn ? "ON" : "OFF"));
                callback();
            });

        this.heaterCoolerService.getCharacteristic(hap.Characteristic.CurrentTemperature)
            .setProps({
                minValue: -100,
                maxValue: 100,
                minStep: 0.1
            })
            .on('get', (callback) => {
                var temp = 0;
                callback(null, temp)
            });

        this.currentHeaterCoolerState = hap.Characteristic.CurrentHeaterCoolerState.INACTIVE;
        // hap.Characteristic.CurrentHeaterCoolerState.COOLING
        // hap.Characteristic.CurrentHeaterCoolerState.HEATING

        this.heaterCoolerService.getCharacteristic(hap.Characteristic.CurrentHeaterCoolerState)
            .on('get', (callback) => {
                log.info("Current mode of AC was returned: " + (this.currentHeaterCoolerState == hap.Characteristic.CurrentHeaterCoolerState.INACTIVE ? "Inactive" : "~"));
                callback(null, this.currentHeaterCoolerState)
            });

        this.targetHeaterCoolerState = hap.Characteristic.TargetHeaterCoolerState.COOL;

        this.heaterCoolerService.getCharacteristic(hap.Characteristic.TargetHeaterCoolerState)
            .setProps({
                validValues: [
                    hap.Characteristic.TargetHeaterCoolerState.COOL,
                    hap.Characteristic.TargetHeaterCoolerState.HEAT
                ]
            })
            .on('get', (callback) => {
                log.info("Target mode of AC was returned: " + (this.targetHeaterCoolerState == hap.Characteristic.TargetHeaterCoolerState.COOL ? "COOL" : "HEAT"));
                callback(null, this.targetHeaterCoolerState)
            })
            .on('set', (value, callback) => {
                this.targetHeaterCoolerState = value;
                log.info("Target mode of AC was set: " + (this.targetHeaterCoolerState == hap.Characteristic.TargetHeaterCoolerState.COOL ? "COOL" : "HEAT"));
                callback()
            });

        this.targetTemperature = 20;

        this.heaterCoolerService.getCharacteristic(hap.Characteristic.CoolingThresholdTemperature)
                .setProps({
                    minValue: 18,
                    maxValue: 32,
                    minStep: 1
                })
                .on('get', (callback) => {
                    log.info("Cooling threshold of AC was returned: " + this.targetTemperature);
                    callback(this.targetTemperature)
                })
                .on('set', (value, callback) => {
                    this.targetTemperature = value;
                    log.info("Cooling threshold of AC was set: " + this.targetTemperature);
                    callback()
                });

        this.heaterCoolerService.getCharacteristic(hap.Characteristic.HeatingThresholdTemperature)
                .setProps({
                    minValue: 10,
                    maxValue: 30,
                    minStep: 1
                })
                .on('get', (callback) => {
                    log.info("Heating threshold of AC was returned: " + this.targetTemperature);
                    callback(this.targetTemperature)
                })
                .on('set', (value, callback) => {
                    this.targetTemperature = value;
                    log.info("Heating threshold of AC was set: " + this.targetTemperature);
                    callback()
                });

        log.info("AC finished initializing!");
    }

    /*
     * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
     * Typical this only ever happens at the pairing process.
     */
    identify() {
        this.log("Identify!");
    }

    /*
     * This method is called directly after creation of this instance.
     * It should return all services which should be added to the accessory.
     */
    getServices() {
        return [
            this.informationService,
            this.heaterCoolerService,
        ];
    }
}
