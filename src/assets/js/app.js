$(document).foundation();
$(document).ready(function(){
    $.getJSON('./assets/json/config_bluecats_australia.json', function(data) {
        var client = EdgeBrokerClient.create(data);
        client.connect();
        client.on('beacon_changed_zone', function(beacon, newZone){
            var tag_zones = client.get_tag_zones();
            var html;
            _.forEach(tag_zones, function(tag){
                var zone =  _.find(zones, function(o) { return o.id === tag.zone; });
                tag.zoneName = zone.name;
                html += '<tr><td>' + tag.tag + '</td><td>' + zone.name +'</td></tr>';
            });
            console.log(tag_zones);


            $('#listView').html(html);
        });

        $('.callout').hide();
        var svg = Snap("#mapbg");
        svg.attr({width: data["svg-width"], height: data["svg-height"]});
        var g = svg.g();
        var image = g.image(data.image, 0,0 );

        var zones = data.zones;

        var myFrames = [
            {animation: { opacity: 0.4, r: 150 }, dur: 500 },
            {animation: { opacity: 0.2, r: 100 }, dur: 500 },
            {animation: { opacity: 0.4, r: 150 }, dur: 500 },
            {animation: { opacity: 0.2, r: 100 }, dur: 500 }
        ];

        function nextFrame ( el, frameArray,  whichFrame, callback ) {
            if( whichFrame >= frameArray.length ) { return callback(); }
            el.animate( frameArray[ whichFrame ].animation, frameArray[ whichFrame ].dur, mina.linear, nextFrame.bind( null, el, frameArray, whichFrame + 1, callback) );
        }

        function highlightZone(objZone){
            var zone = svg.g();
            var r = zone.circle(objZone.x,objZone.y,100).attr({ stroke: '#123456', 'strokeWidth': 2, fill: 'blue', opacity: 0.2 });
            nextFrame(r, myFrames, 0, function(){
                zone.remove();
            });
        }

        function showZone(num){
            var last_seen_zone = client.check_zone(num);
            console.log(last_seen_zone);
            var objZone = _.find(zones, function(o) { return o.id === last_seen_zone; });
            if(objZone){
                highlightZone(objZone);
            }
            $('.callout').html('<h4>Zone: <b>' + objZone.name + '</b></h4>').show();
             setTimeout(function(){
             $('.callout').hide();
             }, 3000)
        }

        $('.num').click(function () {
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
    });
});


/*$(document).ready(function () {
 var client = EdgeBrokerClient.create({"ip": "10.14.1.44", "site":"d2f74800-3ea2-7da1-d34e-d27f15b00630", "map":"2f134a00-28a7-98a4-cb4d-4db0ed45a0e6"});
 client.connect();
 client.on('beacon_changed_zone', function(beacon, newZone){
 console.log('beacon ' + beacon + ' entered ' + newZone);
 });
 $('.callout').hide();

 var svg = Snap("#mapbg");
 svg.attr({width: data["svg-width"], height: data["svg-height"]});
 var g = svg.g();
 var image = g.image(data.image, 0,0 );

 var svg = Snap("#mapbg");
 var g = svg.g();
 var image = g.image("./assets/img/floorplan2.jpg", 0,0, 1401,995 );

 var myFrames = [
 {animation: { opacity: 0.4, r: 150 }, dur: 500 },
 {animation: { opacity: 0.2, r: 100 }, dur: 500 },
 {animation: { opacity: 0.4, r: 150 }, dur: 500 },
 {animation: { opacity: 0.2, r: 100 }, dur: 500 }
 ];

 function nextFrame ( el, frameArray,  whichFrame, callback ) {
 if( whichFrame >= frameArray.length ) { return callback(); }
 el.animate( frameArray[ whichFrame ].animation, frameArray[ whichFrame ].dur, mina.linear, nextFrame.bind( null, el, frameArray, whichFrame + 1, callback) );
 }

 function showZone(num){
 var x, y, zoneName;
 if(num === '1'){
 x = 400;
 y = 700;
 zoneName = 'Zone 1';
 }else if(num === '2'){
 x = 400;
 y = 400;
 zoneName = 'Zone 2';
 }else if(num === '3'){
 x = 1000;
 y = 400;
 zoneName = 'Zone 3';
 }else{
 return;
 }
 var zone = svg.g();
 var r = zone.circle(x , y, 100).attr({ stroke: '#123456', 'strokeWidth': 2, fill: 'blue', opacity: 0.2 });
 nextFrame(r, myFrames, 0, function(){
 zone.remove();
 });
 $('.callout').html('<h4>Zone: <b>' + zoneName + '</b></h4>').show();
 setTimeout(function(){
 $('.callout').hide();
 }, 3000)
 }

 $('.num').click(function () {
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

 });*/