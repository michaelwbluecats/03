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
        var ibeacon = message.device.iBeacon;
        var minor = parseInt(ibeacon.substring(38, 40), 16);

        //console.log(message);
        if(obj.options.beacons_filter.length > 0){
            if(_.indexOf(obj.options.beacons_filter, minor) < 0){
                return;
            }
        }
        switch(message.event.type){
            case 'DWELLED_IN_ZONE':
            case 'ENTERED_ZONE':
                obj.beacon_zones[minor] = message.edgeMAC;
                notify_subscribers(obj, 'beacon_changed_zone', minor);
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

    this.check_zone = function(minor){
        return this.beacon_zones[minor];
    };

    this.get_tag_zones = function(){
        var beacon_zones = this.beacon_zones;
        var tags = _.keys(beacon_zones);
        var tags_zones = [];
        _.forEach(tags, function(tag){
            tags_zones.push({"tag": tag, "zone": beacon_zones[tag]});
        });
        return tags_zones;
    };
}

var EdgeBrokerClient = (function() {
    return {
        create: function(options) {
            return new BCEdgeClient(options);
        }
    };
})();