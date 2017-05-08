$(document).foundation();
var client;
var svg = Snap("#mapbg");
var g = svg.g();
var image;
var zones;
var exclusion_zone;
var myFrames = [
    {animation: { opacity: 0.4, r: 150 }, dur: 1000 },
    {animation: { opacity: 0.2, r: 100 }, dur: 1000 },
    {animation: { opacity: 0.4, r: 150 }, dur: 1000 },
    {animation: { opacity: 0.2, r: 100 }, dur: 1000 }
];

function nextFrame ( el, frameArray,  whichFrame, callback ) {
    if( whichFrame >= frameArray.length ) { return callback(); }
    el.animate( frameArray[ whichFrame ].animation, frameArray[ whichFrame ].dur, mina.linear, nextFrame.bind( null, el, frameArray, whichFrame + 1, callback) );
}

function highlightZone(objZone){
    var zone = svg.g();
    var r = zone.circle(objZone.x,objZone.y,100).attr({ stroke: '#123456', 'strokeWidth': 2, fill: objZone["colour_code"], opacity: 0.2 });
    nextFrame(r, myFrames, 0, function(){
        zone.remove();
    });
}

function showZone(num){
    var event_beacon;
    _.forEach(bclib.locationEngine.beacons, function(beacon){
        var tag_num = parseInt(beacon.iBeacon.substring(38, 40), 16);
        if(tag_num == num){
            event_beacon = beacon;
        }
    });

    var event_edge;
    _.forEach(bclib.locationEngine.devices, function(device){
        if(event_beacon.edgeMAC == device.mac){
            event_edge = device;
        }
    });

    if(event_beacon && event_edge){
        var colour = _.find(zones, function(o) { return o.name == event_beacon.currentZone.name; });
        highlightZone({"x":event_edge.x, "y": event_edge.y, "colour_code": colour["colour_code"]});
        $('.callout').css('background-color', colour["colour_code"]);
        $('.callout').css('border', '2px ' + colour["colour_code"]);
        $('.callout').html('<h4>Tag ' + num + '</h4> <h3><b>' + event_beacon.currentZone.name + '</b></h3>').show();
        setTimeout(function(){
            $('.callout').hide();
        }, 8000)
    }else{
        $('.callout').css('background-color', 'red');
        $('.callout').css('border', '2px red');
        $('.callout').html('<h4>Tag not found</h4>').show();
        setTimeout(function(){
            $('.callout').hide();
        }, 8000)
    }

}

$('.num').click(function () {
    $('.callout').hide();
    var num = $(this);
    var text = $.trim(num.find('.txt').clone().children().remove().end().text());
    var telNumber = $('#telNumber');
    if(text === 'Search'){
        showZone($(telNumber).val());
        $(telNumber).val('');
    } else if(text === 'Del'){
        $(telNumber).val('');
    }
    else {
        $(telNumber).val(telNumber.val() + text);
    }
});

$(document).ready(function(){

    $('.callout').hide();
    $.getJSON('./assets/json/config_bluecats_australia.json', function(data) {
        zones = data.zones;
        exclusion_zone = data.exclusion_zone;
        bclib.locationEngine.Core(data.ip, data.site);
        bclib.locationEngine.on('setup_success', function(x){
            var map = bclib.locationEngine.getMapInfo(data.map);
            svg.attr({width: map.width, height: map.height});
            image = g.image(data.image, 0,0 );
            bclib.locationEngine.on('location_update', function(x){
                var html = '';
                _.forEach(bclib.locationEngine.beacons, function(beacon){
                    if(beacon.currentZone && exclusion_zone == beacon.currentZone.name){
                        return;
                    }

                    var tag_num = parseInt(beacon.iBeacon.substring(38, 40), 16);
                    html += '<tr><td>' + tag_num +
                        '</td><td><a href="javacript:void(0)" onclick="showZone(' + tag_num + ')">' + (beacon.currentZone ? beacon.currentZone.name : '') +'</a></td>' +
                        '<td>' + beacon.zoneDwellTime + 'sec. </td></tr>';
                });
                $('#listView').html(html);
            });
        });
        bclib.locationEngine.start();

    });
});