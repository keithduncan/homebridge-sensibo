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

    private readonly informationService: Service;
    private readonly heaterCoolerService: Service;
    private readonly fanService: Service;

    constructor(log: Logging, config: AccessoryConfig, api: API) {
        this.log = log;
        this.name = config.name;
        this.api = api;

        this.apiKey = config.apiKey;
        this.id = config.id;

        this.informationService = new this.api.hap.Service.AccessoryInformation()
            .setCharacteristic(this.api.hap.Characteristic.Manufacturer, "Sensibo")
            .setCharacteristic(this.api.hap.Characteristic.Model, "Sensibo Sky");

        this.heaterCoolerService = new this.api.hap.Service.HeaterCooler(this.name);
        this.heaterCoolerService.getCharacteristic(this.api.hap.Characteristic.Active)
            .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
                log.info("HeaterCooler Active GET");

                try {
                    let result = await this.fetchRemoteDevice(["acState"]);
                    callback(undefined, result.acState.on);
                }
                catch (err) {
                    log.error(`HeaterCooler Active GET error ${err}`);
                    callback(err)
                }
            })
            .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                log.info(`HeaterCooler Active SET ${value}`);

                try {
                    await this.patchRemoteDevice("on", value == this.api.hap.Characteristic.Active.ACTIVE ? true : false)
                    callback()
                }
                catch (err) {
                    log.error(`HeaterCooler Active SET error ${err}`);
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
                log.info("HeaterCooler CurrentTemperature GET");

                try {
                    let result = await this.fetchRemoteDevice(["measurements"]);
                    // Assume centigrade, or switch on result.temperatureUnit?
                    let temperature = result.measurements.temperature;
                    callback(undefined, temperature)
                }
                catch (err) {
                    log.error(`HeaterCooler CurrentTemperature GET error ${err}`);
                    callback(err)
                }
            });

        this.heaterCoolerService.getCharacteristic(this.api.hap.Characteristic.CurrentHeaterCoolerState)
            .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
                log.info("HeaterCooler CurrentHeaterCoolerState GET");

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
                            // Probably `fan` or `dry` mode, in which case the heater cooler aspect is inactive.
                            log.info(`Unknown state ${acState.mode}`);
                            callback(undefined, this.api.hap.Characteristic.CurrentHeaterCoolerState.INACTIVE)
                        }
                    }
                }
                catch (err) {
                    log.error(`HeaterCooler CurrentHeaterCoolerState GET error ${err}`);
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
                log.info("HeaterCooler TargetHeaterCoolerState GET");

                try {
                    let result = await this.fetchRemoteDevice(["acState"]);

                    let acState = result.acState;
                    if (acState.mode == "heat") {
                        callback(undefined, this.api.hap.Characteristic.TargetHeaterCoolerState.HEAT)
                    } else if (acState.mode == "cool") {
                        callback(undefined, this.api.hap.Characteristic.TargetHeaterCoolerState.COOL)
                    } else {
                        // Probably `fan` or `dry` mode, in which case the heater cooler aspect is inactive.
                        log.info(`Unknown state ${acState.mode}`);
                        callback(undefined, this.api.hap.Characteristic.CurrentHeaterCoolerState.INACTIVE)
                    }
                }
                catch (err) {
                    log.error(`HeaterCooler TargetHeaterCoolerState GET error ${err}`);
                    callback(err)
                }
            })
            .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                log.info(`HeaterCooler TargetHeaterCoolerState SET ${value}`);

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
                    log.error(`HeaterCooler TargetHeaterCoolerState SET error ${err}`);
                    callback(err)
                }
            });

        this.heaterCoolerService.getCharacteristic(this.api.hap.Characteristic.CoolingThresholdTemperature)
            .setProps({
                minValue: 18,
                maxValue: 32,
                minStep: 1
            })
            .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
                log.info("HeaterCooler CoolingThresholdTemperature GET");

                try {
                    let result = await this.fetchRemoteDevice(["acState"]);
                    callback(undefined, result.acState.targetTemperature)
                }
                catch (err) {
                    log.error(`HeaterCooler CoolingThresholdTemperature SET error ${err}`);
                    callback(err)
                }
            })
            .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                log.info(`HeaterCooler CoolingThresholdTemperature SET ${value}`);

                try {
                    let result = await this.patchRemoteDevice("targetTemperature", value);
                    callback()
                }
                catch (err) {
                    log.error(`HeaterCooler CoolingThresholdTemperature SET error ${err}`)
                    callback(err)
                }
            });

        this.heaterCoolerService.getCharacteristic(this.api.hap.Characteristic.HeatingThresholdTemperature)
            .setProps({
                minValue: 10,
                maxValue: 30,
                minStep: 1
            })
            .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
                log.info("HeaterCooler HeatingThresholdTemperature GET");

                try {
                    let result = await this.fetchRemoteDevice(["acState"]);
                    callback(undefined, result.acState.targetTemperature)
                }
                catch (err) {
                    log.error(`HeatingThresholdTemperature SET error ${err}`);
                    callback(err)
                }
            })
            .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                log.info(`HeaterCooler HeatingThresholdTemperature SET ${value}`);

                try {
                    let result = await this.patchRemoteDevice("targetTemperature", value);
                    callback()
                }
                catch (err) {
                    log.error(`HeatingThresholdTemperature SET error ${err}`)
                    callback(err)
                }
            });

        this.fanService = new this.api.hap.Service.Fanv2(this.name);
        this.fanService.getCharacteristic(this.api.hap.Characteristic.Active)
            .on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
                log.info("Fan Active GET");

                try {
                    let result = await this.fetchRemoteDevice(["acState"]);
                    callback(undefined, result.acState.on);
                }
                catch (err) {
                    log.error(`Fan Active GET error ${err}`);
                    callback(err)
                }
            })
            .on(CharacteristicEventTypes.SET, async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                log.info(`Fan Active SET ${value}`);

                try {
                    if (value == this.api.hap.Characteristic.Active.ACTIVE) {
                        await this.patchRemoteDevice("mode", "fan");
                    }

                    await this.patchRemoteDevice("on", value == this.api.hap.Characteristic.Active.ACTIVE ? true : false)
                    
                    callback()
                }
                catch (err) {
                    log.error(`Fan Active SET error ${err}`);
                    callback(err)
                }
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
            //this.fanService,
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
