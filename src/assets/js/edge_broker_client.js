'use strict'
function BCEdgeClient(options){
    if (!options.ip) {
        throw new Error('options.ip is required');
    }
    if (!options.site) {
        throw new Error('options.site is required');
    }
    if (!options.map) {
        throw new Error('options.map is required');
    }
    if (!options.port) {
        options.port = 1884;
    }

    this.options = options;
    this.event_delegates = {};
    this.beacon_zones = {};

    function notify_subscribers(obj, event, device){
        switch(event){
            case 'beacon_changed_zone':
                _.forEach(obj.event_delegates[event], function(item){
                    item(device, obj.beacon_zones[device]);
                });
                break;
        }
    }

    function message_handler(obj, message){
        var device = message.device.mac;
        switch(message.event.type){
            case 'ENTERED_EDGE':
                obj.beacon_zones[device] = message.edgeMAC;
                notify_subscribers(obj, 'beacon_changed_zone', device);
                break;
        }
    }

    this.connect = function(){
        var root = this;
        this.mqttClient = mqtt.connect("ws://" + this.options.ip + ":" + this.options.port);
        this.mqttClient.on('connect', function () {
            console.log('connected');
        });
        this.mqttClient.on('error', function () {
            console.log('error');
        });
        this.mqttClient.subscribe('site/' + this.options.site + '/map/' + this.options.map + '/edge/+/device/event/+');
        this.mqttClient.on('message', function (topic, message) {
            var mqtt_evt = JSON.parse(message);
            message_handler(root, mqtt_evt);
        });
    };

    this.on = function(event, delegate){
        if (typeof delegate != 'function'){
            return;
        }
        if(!this.event_delegates[event]){
            this.event_delegates[event] = [];
        }
        this.event_delegates[event].push(delegate);
    };

    this.check_zone = function(beacon){
        return this.beacon_zones[beacon];
    };
}

var EdgeBrokerClient = (function() {
    return {
        create: function(options) {
            return new BCEdgeClient(options);
        }
    };
})();