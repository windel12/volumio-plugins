'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var raspi = require('raspi');
var Serial = require('raspi-serial').Serial;

module.exports = uartControl;
function uartControl(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

	raspi.init(() => {
		self.serial = new Serial({
			baudRate: 9600,
			dataBits: 8,
			stopBits: 1,
			parity: "even"
		});
		self.serial.open(() => {
			self.serial.on('data', (data) => {
				process.stdout.write(data);
			});
			//self.serial.write('Hello from raspi-serial');
			setInterval(function(serial){
				delay(184, serial).then(function(){
					return delay(18, serial).then(function(){
						return delay(241, serial).then(function(){
							return delay(4, serial);
						})
					})
				})
			}, 500, self.serial);
		});
	});
}

function delay(byte, serial) {
	var defer = libQ.defer();
	setTimeout(function(serial) {
		serial.write(Buffer.from([byte]));
		defer.resolve();
	}, 3, serial);
	return defer.promise;
}

uartControl.prototype.onVolumioStart = function() {
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

uartControl.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();

	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

    return defer.promise;
};

uartControl.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

uartControl.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};

// Configuration Methods -----------------------------------------------------------------------------
uartControl.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

uartControl.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

uartControl.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

uartControl.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

uartControl.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it
uartControl.prototype.addToBrowseSources = function () {
	// Use this function to add your music service plugin to music sources
    //var data = {name: 'Spotify', uri: 'spotify',plugin_type:'music_service',plugin_name:'spop'};
    this.commandRouter.volumioAddToBrowseSources(data);
};

uartControl.prototype.handleBrowseUri = function (curUri) {
    var self = this;

    //self.commandRouter.logger.info(curUri);
    var response;
    return response;
};

// Define a method to clear, add, and play an array of tracks
uartControl.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'uartControl::clearAddPlayTrack');

	self.commandRouter.logger.info(JSON.stringify(track));

	return self.sendSpopCommand('uplay', [track.uri]);
};

uartControl.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'uartControl::seek to ' + timepos);

    return this.sendSpopCommand('seek '+timepos, []);
};

// Stop
uartControl.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'uartControl::stop');
};

// Spop pause
uartControl.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'uartControl::pause');
};

// Get state
uartControl.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'uartControl::getState');
};

//Parse state
uartControl.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'uartControl::parseState');

	//Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
uartControl.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'uartControl::pushState');

	if(self.serial._isOpen) {
		self.serial.write('pushState');
	}
	return libQ.resolve();
};

uartControl.prototype.explodeUri = function(uri) {
	var self = this;
	var defer=libQ.defer();

	// Mandatory: retrieve all info for a given URI

	return defer.promise;
};

uartControl.prototype.getAlbumArt = function (data, path) {
	var artist, album;

	if (data != undefined && data.path != undefined) {
		path = data.path;
	}

	var web;

	if (data != undefined && data.artist != undefined) {
		artist = data.artist;
		if (data.album != undefined)
			album = data.album;
		else album = data.artist;

		web = '?web=' + nodetools.urlEncode(artist) + '/' + nodetools.urlEncode(album) + '/large'
	}

	var url = '/albumart';

	if (web != undefined)
		url = url + web;

	if (web != undefined && path != undefined)
		url = url + '&';
	else if (path != undefined)
		url = url + '?';

	if (path != undefined)
		url = url + 'path=' + nodetools.urlEncode(path);

	return url;
};

uartControl.prototype.search = function (query) {
	var self=this;
	var defer=libQ.defer();

	// Mandatory, search. You can divide the search in sections using following functions

	return defer.promise;
};

uartControl.prototype._searchArtists = function (results) {
};

uartControl.prototype._searchAlbums = function (results) {
};

uartControl.prototype._searchPlaylists = function (results) {
};

uartControl.prototype._searchTracks = function (results) {
};

uartControl.prototype.goto=function(data){
    var self=this
    var defer=libQ.defer()

	// Handle go to artist and go to album function
     return defer.promise;
};