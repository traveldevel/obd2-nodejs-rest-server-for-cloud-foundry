"use strict";

// Load env vars from .env
require('dotenv').config();

const port = process.env.PORT || 8080;
const authorizedUsers = process.env.BASIC_AUTH_USERS.split(',');
const authorizedUserPasswords = process.env.BASIC_AUTH_USER_PASSWORDS.split(',');

const ODataServer = require("simple-odata-server");
const basicAuth = require('basic-auth');
const MongoClient = require('mongodb').MongoClient;

// auth global function
const auth = function (req, res, next) {
    
    if(req.method === "OPTIONS"){
        return next();
    }

    function unauthorized(res) {
        res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
        return res.sendStatus(401);
    };

    var user = basicAuth(req);

    if (!user || !user.name || !user.pass) {
        return unauthorized(res);
    };

    if (authorizedUsers.indexOf(user.name) >= 0 && authorizedUserPasswords.indexOf(user.pass) >= 0) {
        return next();
    } else {
        return unauthorized(res);
    };
};

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

// mongoose models
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

var obdTripSchema = mongoose.Schema({
    
    receivedId: 'Number',
    receivedDate: 'Date',
    obdVin: 'String',
    startUTCTicks : 'Number',
    endUTCTicks : 'Number',
    totalMinutes : 'Number',
    manualStartOdometer : 'Number',
    estimatedEndOdometer : 'Number',
    estimatedDistance : 'Number',
    averageSpeed : 'Number'
});

var obdTrip = mongoose.model('obdTrip', obdTripSchema);

// odata service model
var model = {
    namespace: mongoDbName,
    entityTypes: {
        'obdrecords':{
            "_id": { "type": "Edm.String", key: true},
            "receivedId": { "type": "Edm.Integer"},
            "receivedDate": { "type": "Edm.DateTime"},
            "obdVin": { "type": "Edm.String"},
            "recordedTimestamp": { "type": "Edm.Integer"},
            "manualOdometer": { "type": "Edm.Integer"},

            "obdSpeed": { "type": "Edm.Integer"},
            "obdRpm": { "type": "Edm.Integer"},
            "obdThrotlePosition": { "type": "Edm.Integer"},
            "obdEngineLoad": { "type": "Edm.Integer"},
            "obdCoolantTemp": { "type": "Edm.Integer"},
            "obdOilTemp": { "type": "Edm.Integer"},

            "gpsLatitude": { "type": "Edm.Decimal"},
            "gpsLongitude": { "type": "Edm.Decimal"},
            "gpsAltitude": { "type": "Edm.Integer"},
            "gpsSpeed":  { "type": "Edm.Integer"},
            "gpsBearing":  { "type": "Edm.Integer"},
            "gpsAccuracy":  { "type": "Edm.Integer"},
            "orientDir": { "type": "Edm.String"},
        
            "accelerationX": { "type": "Edm.Decimal"},
            "accelerationY": { "type": "Edm.Decimal"},
            "accelerationZ": { "type": "Edm.Decimal"},
            "accelerationTotal": { "type": "Edm.Decimal"}            
        },
        'obdtrips':{
            "_id": { "type": "Edm.String", key: true},
            "receivedId": { "type": "Edm.Integer"},
            "obdVin": { "type": "Edm.String"},
            "startUTCTicks": { "type": "Edm.Integer"},
            "endUTCTicks": { "type": "Edm.Integer"},
            "totalMinutes": { "type": "Edm.Decimal"},
            "manualStartOdometer": { "type": "Edm.Integer"},
            "estimatedEndOdometer": { "type": "Edm.Integer"},
            "estimatedDistance": { "type": "Edm.Decimal"},
            "averageSpeed": { "type": "Edm.Decimal"}
        }
    },   
    entitySets: {}
};

model.entitySets["obdrecords"] = { entityType: mongoDbName + ".obdrecords" };
model.entitySets["obdtrips"] = { entityType: mongoDbName + ".obdtrips" };
    
// Instantiates ODataServer and assigns to odataserver variable.
var odataServer = ODataServer().model(model);
odataServer.cors('*');

odataServer.error(function(req, res, error, next){
    console.log(err);
    next();
})

// Connection to database in MongoDB fo odata server
var mongoClient = require('mongodb').MongoClient;

MongoClient.connect(mongoUrl, function(err, db) {
    
    if(err){
        console.log(err);
    }

    odataServer.onMongo(function(cb) { cb(err, db); });
});

// express app
var app = express();

app.use(bodyParser.json());

// The directive to set app route path for odata backend
app.use("/odata", auth, function (req, res) {
    odataServer.handle(req, res);
});

app.post('/postTrips', function(req, res) {
    console.log(req.body);
    
    var n = req.body.length;
    console.log(n, " trips received");

    var saved = [];
    
    for(var i = 0; i < n; i++){

        var received = req.body[i];

        var trip = new obdTrip({
            
            receivedId: received.id,
            receivedDate: new Date(),
            obdVin: received.obdVin,
            startUTCTicks : received.startUTCTicks,
            endUTCTicks : received.endUTCTicks,
            totalMinutes : received.totalMinutes,
            manualStartOdometer : received.manualStartOdometer,
            estimatedEndOdometer : received.estimatedEndOdometer,
            estimatedDistance : received.estimatedDistance,
            averageSpeed : received.averageSpeed
        });
        
        trip.save(function (err, savedTrip) {
            if (err) {
                res.json(err);     
                res.end();           
                return console.error(err);
            }
        
            console.log(savedTrip);

            saved.push(savedTrip);
            console.log(saved.length, " trips saved");

            if(saved.length === n){
                res.json(saved);
                res.end();
            }
        });
    }
});

app.post('/postObd', function(req, res) {
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