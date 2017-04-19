$(document).foundation();
var client;
var svg = Snap("#mapbg");
var g = svg.g();
var image;
var zones;
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
    var last_seen_zone = client.check_zone(num);
    var objZone = _.find(zones, function(o) { return o.id === last_seen_zone; });
    if(objZone){
        highlightZone(objZone);
        $('.callout').css('background-color', objZone["colour_code"]);
        $('.callout').css('border', '2px ' + objZone["colour_code"]);
        $('.callout').html('<h4>Tag ' + num + '</h4> <h3><b>' + objZone.name + '</b></h3>').show();
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
    $.getJSON('./assets/json/config_bankstown.json', function(data) {
        client = EdgeBrokerClient.create(data);
        client.connect();
        client.on('beacon_changed_zone', function(beacon, newZone){
            var tag_zones = client.get_tag_zones();
            var html = '';
            _.forEach(tag_zones, function(tag){
                var zone =  _.find(zones, function(o) { return o.id === tag.zone; });
                tag.zoneName = zone.name;
                html += '<tr><td>' + tag.tag + '</td><td><a href="javacript:void(0)" onclick="showZone(' + tag.tag + ')">' + zone.name +'</a></td></tr>';
            });
            $('#listView').html(html);
        });

        svg.attr({width: data["svg-width"], height: data["svg-height"]});
        image = g.image(data.image, 0,0 );
        zones = data.zones;
    });
});