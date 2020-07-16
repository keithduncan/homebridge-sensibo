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

const got = require("got");

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

        this.heaterCoolerService = new this.api.hap.Service.HeaterCooler(this.name);
        this.heaterCoolerService.getCharacteristic(this.api.hap.Characteristic.Active)
            .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
                log.info("Active GET");

                try {
                    let result = await this.fetchRemoteDevice(["acState"]);
                    callback(undefined, result.acState.on);
                }
                catch (err) {
                    log.error(`Active GET error ${err}`);
                    callback(err)
                }
            })
            .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                log.info(`Active SET ${value}`);

                try {
                    await this.patchRemoteDevice("on", value == this.api.hap.Characteristic.Active.ACTIVE ? true : false)
                    callback()
                }
                catch (err) {
                    log.error(`Active SET error ${err}`);
                    callback(err)
                }
            });

        this.heaterCoolerService.getCharacteristic(this.api.hap.Characteristic.CurrentTemperature)
            .setProps({
                minValue: -100,
                maxValue: 100,
                minStep: 0.1
            })
            .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
                log.info("CurrentTemperature GET");

                try {
                    let result = await this.fetchRemoteDevice(["measurements"]);
                    // Assume centigrade, or switch on result.temperatureUnit?
                    let temperature = result.measurements.temperature;
                    callback(undefined, temperature)
                }
                catch (err) {
                    log.error(`CurrentTemperature GET error ${err}`);
                    callback(err)
                }
            });

        this.heaterCoolerService.getCharacteristic(this.api.hap.Characteristic.CurrentHeaterCoolerState)
            .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
                log.info("CurrentHeaterCoolerState GET");

                try {
                    let result = await this.fetchRemoteDevice(["acState"]);

                    let acState = result.acState;
                    if (!acState.on) {
                        callback(undefined, this.api.hap.Characteristic.CurrentHeaterCoolerState.INACTIVE)
                    } else {
                        if (acState.mode == "heat") {
                            callback(undefined, this.api.hap.Characteristic.CurrentHeaterCoolerState.HEATING)
                        } else if (acState.mode == "cool") {
                            callback(undefined, this.api.hap.Characteristic.CurrentHeaterCoolerState.COOLING)
                        } else {
                            throw `Unknown state ${acState.mode}`
                        }
                    }
                }
                catch (err) {
                    log.error(`CurrentHeaterCoolerState GET error ${err}`);
                    callback(err)
                }
            });

        this.heaterCoolerService.getCharacteristic(this.api.hap.Characteristic.TargetHeaterCoolerState)
            .setProps({
                validValues: [
                    this.api.hap.Characteristic.TargetHeaterCoolerState.COOL,
                    this.api.hap.Characteristic.TargetHeaterCoolerState.HEAT
                ]
            })
            .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
                log.info("TargetHeaterCoolerState GET");

                try {
                    let result = await this.fetchRemoteDevice(["acState"]);

                    let acState = result.acState;
                    if (acState.mode == "heat") {
                        callback(undefined, this.api.hap.Characteristic.TargetHeaterCoolerState.HEAT)
                    } else if (acState.mode == "cool") {
                        callback(undefined, this.api.hap.Characteristic.TargetHeaterCoolerState.COOL)
                    } else {
                        throw `Unknown state ${acState.mode}`
                    }
                }
                catch (err) {
                    log.error(`TargetHeaterCoolerState GET error ${err}`);
                    callback(err)
                }
            })
            .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                log.info(`TargetHeaterCoolerState SET ${value}`);

                try {
                    let mode;
                    if (value == this.api.hap.Characteristic.TargetHeaterCoolerState.HEAT) {
                        mode = "heat";
                    } else if (value == this.api.hap.Characteristic.TargetHeaterCoolerState.COOL) {
                        mode = "cool";
                    } else {
                        throw `Unknown mode ${value}`
                    }

                    let result = await this.patchRemoteDevice("mode", mode);
                    callback()
                }
                catch (err) {
                    log.error(`TargetHeaterCoolerState SET error ${err}`);
                    callback(err)
                }
            });

        this.heaterCoolerService.getCharacteristic(this.api.hap.Characteristic.CoolingThresholdTemperature)
            .setProps({
                minValue: 18,
                maxValue: 32,
                minStep: 1
            })
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                log.info("CoolingThresholdTemperature GET");
                callback(undefined, 0)
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                log.info(`CoolingThresholdTemperature SET ${value}`);
                callback()
            });

        this.heaterCoolerService.getCharacteristic(this.api.hap.Characteristic.HeatingThresholdTemperature)
            .setProps({
                minValue: 10,
                maxValue: 30,
                minStep: 1
            })
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                log.info("HeatingThresholdTemperature GET");
                callback(undefined, 0)
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                log.info(`HeatingThresholdTemperature SET ${value}`);
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

    async fetchRemoteDevice(fields: String[]) {
        var apiFields = "*";
        if (fields.length > 0) {
            apiFields = fields.join(",");
        }
        const response = await got(`https://home.sensibo.com/api/v2/pods/${this.id}?apiKey=${this.apiKey}&fields=${apiFields}`);
        this.log.info("Response: " + response.body);

        let json = JSON.parse(response.body);
        if (json.status != "success") {
            throw "Response `status` was not success";
        }

        let result = json.result;
        return result;
    }

    async patchRemoteDevice(field: String, value: any) {
        const body = JSON.stringify({'newValue': value});
        this.log.info(`PATCH ${body}`);

        const response = await got(`https://home.sensibo.com/api/v2/pods/${this.id}/acStates/${field}?apiKey=${this.apiKey}`, {
            method: 'PATCH',
            body: body
        });
        this.log.info("Response: " + response.body);

        let json = JSON.parse(response.body);
        if (json.status != "success") {
            throw "Response `status` was not success";
        }

        let result = json.result;
        return result;
    }
}
