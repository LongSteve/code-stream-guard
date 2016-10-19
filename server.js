//
// The web server module, to send events to the front end display, using websockets
//

var _ = require ('lodash');

var fs = require ('fs');
var util = require ('util');

var EventEmitter = require ('events').EventEmitter;

var http = require('http');

var Server = function Server () {
   var self = this;

   var express = require ('express');
   var app = express ();
   var http = require ('http').Server (app);
   var io = require ('socket.io') (http);

   app.use (express.static (__dirname + '/frontend/'));

   app.get ('/', function (req, res) {
     res.sendFile (__dirname + '/frontend/index.html');
   });

   app.get ('/socket.io.js', function (req, res) {
     res.sendFile (__dirname + '/node_modules/socket.io/node_modules/socket.io-client/socket.io.js');
   });

   http.listen (3000, function () {
     console.log ('listening on *:3000');
   });

   io.on ('connection', function (_socket) {
     console.log ('front end connected');
     socket = _socket;

     self.emit ('connected', _socket);
     socket.on ('disconnect', function () {
       console.log ('front end disconnected');
       self.emit ('disconnected', _socket);
     });
   });

   self.toClient = function (_socket, name, event) {
      if (_socket) {
         _socket.emit (name, event);
      }
   };
};

util.inherits (Server, EventEmitter);

module.exports = exports = new Server ();

