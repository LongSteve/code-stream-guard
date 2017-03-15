//
// The web server module, to send events to the front end display, using websockets
//

var _ = require ('lodash');

var winston = require ('winston');

var fs = require ('fs');
var util = require ('util');

var EventEmitter = require ('events').EventEmitter;

var http = require('http');

var __approot = require('app-root-path');

var sockets = [];

var Server = function Server () {
   var self = this;

   var express = require ('express');
   var app = express ();
   var http = require ('http').Server (app);
   var io = require ('socket.io') (http);

   app.use (express.static (__approot + '/frontend/'));

   //app.get ('/', function (req, res) {
   //  res.sendFile (__dirname + '/frontend/index.html');
   //});

   app.get ('/socket.io.js', function (req, res) {
     res.sendFile (__approot + '/node_modules/socket.io-client/dist/socket.io.min.js');
   });

   http.listen (3000, function () {
     winston.info ('listening on *:3000');
   });

   io.on ('connection', function (_socket) {
     winston.info ('front end connected');
     sockets.push (_socket);

     self.emit ('connected', _socket);
     _socket.on ('disconnect', function () {
       winston.info ('front end disconnected');
       self.emit ('disconnected', _socket);
     });

     _socket.on ('window', function (data) {
        winston.info ('window event: ' + JSON.stringify (data));
        self.emit ('window', _socket, data);
     });

   });

   self.toClient = function (name, event, _socket) {
      if (_socket) {
         winston.debug ("Single socket emit: " + name);
         _socket.emit (name, event);
      } else {
         winston.debug ("All socket emit: " + name);
         sockets.forEach (function (_s) {
            _s.emit (name, event);
         });
      }
   };
};

util.inherits (Server, EventEmitter);

module.exports = exports = new Server ();

