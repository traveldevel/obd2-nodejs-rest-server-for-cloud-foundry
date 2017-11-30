"use strict";

const port = process.env.PORT || 8080;

// Assign the required packages and dependencies to variables
const express = require('express');
var bodyParser = require('body-parser')

const cfenv = require("cfenv");
var appEnv = cfenv.getAppEnv();
const services = appEnv.getServices();
//console.log(services);

// get mongo url from service function
var getMongoUrlForService = function(mongoServiceName) {

    var mongoService = services[mongoServiceName];

    var mongoCredentials = {};
    
    var mongoUrl = '';
    var mongoDbName = '';

    if(mongoService !== undefined){
        mongoCredentials = services[mongoServiceName].credentials;

        mongoUrl = mongoService.credentials.uri;
        
        var mongodbUri = require('mongodb-uri');
        var uriObject = mongodbUri.parse(mongoUrl);
        mongoDbName = uriObject.database;
        
        console.log("'" + mongoServiceName + "' found in VCAP_SERVICES ! ");
        console.log("Url for mongodb : '" + mongoUrl + "'");
        console.log("DB for mongodb : '" + mongoDbName + "'");
    }

    return { "url" : mongoUrl, "db" : mongoDbName};
}

// get mongoDb Url from service
var mongoConnData = getMongoUrlForService("obd2_mongo_server1");
var mongoUrl = mongoConnData.url; 
var mongoDbName = mongoConnData.db;

var mongoose = require('mongoose');
var options = {
    useMongoClient: true,
    socketTimeoutMS: 0,
    keepAlive: true,
    reconnectTries: 30
  };  
var db = mongoose.connect(mongoUrl, options);
db.on('error', console.error.bind(console, 'Mongo DB connection error : '));

var Schema = mongoose.Schema;
var ObjectIdSchema = Schema.ObjectId;
var ObjectId = mongoose.Types.ObjectId;

var obdRecordSchema = mongoose.Schema({
    
    receivedId: 'Number',
    receivedDate: 'Date',
    obdVin: 'String',
    recordedTimestamp: 'Number',
    manualOdometer: 'Number',

    obdSpeed: 'Number',
    obdRpm: 'Number',
    obdThrotlePosition: 'Number',
    obdEngineLoad: 'Number',
    obdCoolantTemp: 'Number',
    obdOilTemp: 'Number',

    gpsLatitude: 'Number',
    gpsLongitude: 'Number',
    gpsAltitude: 'Number',
    gpsSpeed: 'Number',
    gpsBearing: 'Number',
    gpsAccuracy: 'Number',
    orientDir: 'String',

    accelerationX: 'Number',
    accelerationY: 'Number',
    accelerationZ: 'Number',
    accelerationTotal: 'Number'
});

var obdRecord = mongoose.model('obdRecord', obdRecordSchema);

var app = express();

app.use(bodyParser.json());

app.post('/', function(req, res) {
    console.log(req.body);

    var n = req.body.length;
    console.log(n, " records received");

    var saved = [];

    for(var i = 0; i < n; i++){

        var received = req.body[i];

        var record = new obdRecord({

            receivedId: received.id,
            obdVin: received.obdVin,
            receivedDate: new Date(),
            recordedTimestamp : received.UTCTicks,
            manualOdometer: received.manualOdometer,

            obdSpeed: received.obdSpeed,
            obdRpm: received.obdRpm,
            obdThrotlePosition: received.obdThrotlePosition,
            obdEngineLoad: received.obdEngineLoad,
            obdCoolantTemp: received.obdCoolantTemp,
            obdOilTemp: received.obdOilTemp,

            gpsLatitude: received.gpsLatitude,
            gpsLongitude: received.gpsLongitude,
            gpsAltitude: received.gpsAltitude,
            gpsSpeed: received.gpsSpeed,
            gpsBearing: received.gpsBearing,
            gpsAccuracy: received.gpsAccuracy,
            orientDir: received.orientDir,

            accelerationX: received.accelerationX,
            accelerationY: received.accelerationY,
            accelerationZ: received.accelerationZ,
            accelerationTotal: received.accelerationTotal
        });
        
        record.save(function (err, savedRecord) {
            if (err) {
                res.json(err);     
                res.end();           
                return console.error(err);
            }
        
            console.log(savedRecord);

            saved.push(savedRecord);
            console.log(saved.length, " records saved");

            if(saved.length === n){
                res.json(saved);
                res.end();
            }
        });
    }
});

// The app listens on port 8080 (or other from env) and prints the endpoint URI in console window.
var server = app.listen(port, function () {
    console.log('OBD REST Server listening on ' + appEnv.url + ':' + port);
});