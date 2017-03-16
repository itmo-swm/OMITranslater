var express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var xml2js = require('xml2js');

const ORION_SERVER = 'http://192.168.1.199:1026/v1';

var Orion = require('./orion/orion-lib'),
    OrionClient = new Orion.Client({
        url: ORION_SERVER,
        service: 'omitest',      // Fiware-Service
        servicePath: '/',
        token: 'key',
        userAgent: 'IOT-Agent',
        timeout: 5000
    });

var queryOptions = {
    type: '',
    id: 'TempTest1'
};
/*
OrionClient.queryContext(queryOptions).then(function(contextData) {
    console.log('Context data retrieved: ', JSON.stringify(contextData));
}, function(error) {
    console.log('Error while querying context: ', error);
});
*/

var carentity = {
    type: 'car',
    id: 'car1',
    buildYear:" "
};
var registrationParams = {};
registrationParams.updateAction = 'APPEND';
OrionClient.updateContext(carentity,registrationParams).then(
    function(registration) {
        console.log('Context registered: ', JSON.stringify(registration));
    }, function(err) {
    console.log('Error while querying context: ', err);
});

var entity = {
    type: '',
    id: 'car1',
    attributes: ['buildYear']
};

var subscrParams = {
    callback: 'http://192.168.1.199:1028/accumulate',
    type: 'ONCHANGE', // By default if nothing said
    attributes: ['buildYear']
};
OrionClient.subscribeContext(entity, subscrParams).then(
    function(subscription) {
        console.log('Context subscribed: ', JSON.stringify(subscription));
    }).catch(function(err) {
    console.log('Error while querying context: ', err);
});

OrionClient.contextEntities().then(function(contextData) {
    console.log('Context data retrieved: ', JSON.stringify(contextData));
}, function(error) {
    console.log('Error while querying context: ', error);
});
var t = 1900;
setInterval(function() {
    var contextData = {
        type: '',
        id: 'car1',
        'buildYear': String(t++)
    };

    OrionClient.updateContext(contextData).then(function(updatedData) {
        console.log('Context data updated: ', JSON.stringify(updatedData));
    }).catch(function(err) {
        console.log('Error while querying context: ', error);
    });
}, 3000);
OrionClient.contextEntities().then(function(contextData) {
    console.log('Context data retrieved: ', JSON.stringify(contextData));
}, function(error) {
    console.log('Error while querying context: ', error);
});
/*
var deleteQuery = {
    type: '',
    id: 'car1'
};

OrionClient.deleteContext(deleteQuery);
*/

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(xmlBodyParser);
var router = express.Router();

function xmlBodyParser(req, res, next) {
    if (req._body) return next();
    req.body = req.body || {};

    // ignore GET
    if ('GET' == req.method || 'HEAD' == req.method) return next();

    // check Content-Type
    if ('text/xml' != req.headers['content-type']) return next();
    // flag as parsed
    req._body = true;

    // parse
    var buf = '';
    req.setEncoding('utf8');
    req.on('data', function(chunk){ buf += chunk });
    req.on('end', function(){
        var parseString = xml2js.parseString;
        parseString(buf, function(err, json) {
            if (err) {
                err.status = 400;
                next(err);
            } else {
                console.log(JSON.stringify(json));
                req.body = json;
                next();
            }
        });
    });
}

router.get('/omi', function(req, res, next) {
    var json = JSON.parse('{"omi:omiEnvelope":{"$":{"xmlns:xsi":"http://www.w3.org/2001/XMLSchema-instance","xmlns:omi":"omi.xsd","xsi:schemaLocation":"omi.xsd omi.xsd","version":"1.0","ttl":"0"},"omi:write":[{"$":{"msgformat":"odf"},"omi:msg":[{"$":{"xmlns":"odf.xsd","xsi:schemaLocation":"odf.xsd odf.xsd"},"Objects":[{"Object":[{"id":["SmartFridge22334411"],"InfoItem":[{"$":{"name":"FridgeTemperatureSetpoint"},"value":[{"_":"15.5","$":{"dateTime":"2001-10-26T15:33:21"}},{"_":"15.7","$":{"dateTime":"2001-10-26T15:33:50"}},{"_":"1.3","$":{"dateTime":"2001-10-26T15:34:15"}},{"_":"1.5","$":{"dateTime":"2001-10-26T15:34:35"}},{"_":"15.3","$":{"dateTime":"2001-10-26T15:34:52"}}]},{"$":{"name":"FreezerTemperatureSetpoint"},"value":["15.1"]}]}]}]}]}]}}');
    var builder = new xml2js.Builder();
    var xml = builder.buildObject(json);
    res.header('Content-Type', 'text/xml');
    res.send(xml);
});

function isEmpty(value) {
    return typeof value == 'string' && !value.trim() || typeof value == 'undefined' || value === null;
}

router.post('/omi', function(req, res, next) {
    var result;
    if(req.body) {
        if (!isEmpty(JSON.stringify(req.body['omi:omiEnvelope']['omi:read']))) {
            var what = req.body['omi:omiEnvelope']['omi:read'][0]['omi:msg'][0];
            if (isEmpty(JSON.stringify(what))) {
                result = ['*'];
            } else {
                what = what['Objects'];
                result = [];
                for (var object in what) {
                    for (var o in what[object]['Object']) {
                        var tobj = {};
                        tobj.id = what[object]['Object'][o]['id'];
                        tobj.items = [];
                        if (what[object]['Object'][o]["InfoItem"]) {
                            var items = what[object]['Object'][o]["InfoItem"];
                            for (var item in items) {
                                tobj.items.push(items[item]['$']['name']);
                            }
                        }
                        result.push(tobj);
                    }
                }
            }
        } else {
            var what = req.body['omi:omiEnvelope']['omi:write'][0]['omi:msg'][0];
            what = what['Objects'];
            result = [];
            for (var object in what) {
                for (var o in what[object]['Object']) {
                    var tobj = {};
                    tobj.id = what[object]['Object'][o]['id'];
                    tobj.values = [];
                    if (what[object]['Object'][o]["InfoItem"]) {
                        var items = what[object]['Object'][o]["InfoItem"];
                        for (var item in items) {
                            var val = {};
                            val.id = items[item]['$']['name'];
                            val.value = [];
                            for(var v in items[item]['value']){
                                var subval = {};
                                if(items[item]['value'][v]['$']){
                                    subval.value = items[item]['value'][v]['_'];
                                    subval.params = items[item]['value'][v]['$'];
                                }else{
                                    subval.value = items[item]['value'][v];
                                    subval.params = {};
                                }
                                val.value.push(subval);
                            }
                            tobj.values.push(val);
                        }
                    }
                    result.push(tobj);
                }
            }
        }
    }
    res.send(JSON.stringify(result));
});

app.use('/', router);

app.set('port', '3000');

var server = http.createServer(app);

server.listen(app.get('port'));