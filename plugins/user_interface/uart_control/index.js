'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
try {
	var raspi = require('raspi');
	var Serial = require('raspi-serial').Serial;
}
catch {

}

module.exports = uartControl;
function uartControl(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

	self.logger.info("uart_control created!");

	if (!raspi) {
		return;
	}

	raspi.init(() => {
		self.logger.info("raspi-serial inited!");

		self.serial = new Serial({
			baudRate: 9600,
			dataBits: 8,
			stopBits: 1,
			parity: "even"
		});
		self.serial.open(() => {
			self.logger.info("/dev/serial0 opened!");

			var data = Buffer.from('Volumio READY!', 'utf-8').toJSON().data
			data = [0, 0].concat(data);
			self.serial.write(createIBusMessage.apply(null, data));

			self.serial.on('data', (data) => {
				self.logger.info("/dev/serial0 data received!");

				self.handleData(data);
			});
		});
	});
}

function createIBusMessage() {
	var args = arguments;
	var source = 249; // 0xF9 - Volumio
	var packetLength = args.length + 2;
	var destination = 250; // 0xFA - imBMW(or your own any ID)
	var check = 0;
	check ^= source;
	check ^= packetLength;
	check ^= destination;
	for(var i = 0; i < args.length; i++){
		check ^= args[i];
	}
	var dataDump = [source, packetLength, destination];
	for(var i = 0; i < args.length; i++){
		dataDump.push(args[i]);
	}
	dataDump.push(check);
	return Buffer.from(dataDump);
}

uartControl.prototype.volumioCommands = {
	common: 0,
	playback: 1,
	system: 2,
	clearQueue: 3,
	addPlaylistToQueue: 4
}

uartControl.prototype.commonCommands = {
	init: 0,
	displayMessage: 1,
	displayMessageWithGong: 2
}

uartControl.prototype.handleData = function(data) {
	var self = this;

	if (data[2] == 249) { // Source: Volumio
		if (data[3] == 1) { // playback
			switch (data[4]) {
				case 1:
					self.commandRouter.volumioStop();
					break;
				case 2:
					self.commandRouter.volumioPause();
					break;
				case 3:
					self.commandRouter.volumioPlay();
					break;
				case 4:
					self.commandRouter.volumioPrevious();
					break;
				case 5:
					self.commandRouter.volumioNext();
					break;
				case 6:
					var position = (data[5] << 8) + data[6];
					self.commandRouter.volumioSeek(position);
					break;
			}
		}
		if(data[3] == 2) { // System
			switch (data[4]) {
				case 1:
					break;
				case 2:
					var data = Buffer.from('going to reboot', 'utf-8').toJSON().data
					data = [2, 2].concat(data);
					self.serial.write(createIBusMessage.apply(null, data));
					self.commandRouter.reboot();
					break;
				case 3:
					var data = Buffer.from('going to shutdown', 'utf-8').toJSON().data
					data = [2, 3].concat(data);
					self.serial.write(createIBusMessage.apply(null, data));
					self.commandRouter.shutdown();
					break;
			}
		}
		if (data[3] == 3) { // ClearQueue
			self.commandRouter.volumioClearQueue();
			var data = Buffer.from('Queue cleared', 'utf-8').toJSON().data
			data = [self.volumioCommands.common, self.commonCommands.displayMessageWithGong].concat(data);
			self.serial.write(createIBusMessage.apply(null, data));
		}
		if (data[3] == 4) { // AddPlaylistToQueue
			var number = data[4];
			self.commandRouter.playListManager.enqueue(number.toString());
			var data = Buffer.from('Added #' + number, 'utf-8').toJSON().data
			data = [self.volumioCommands.common, self.commonCommands.displayMessageWithGong].concat(data);
			self.serial.write(createIBusMessage.apply(null, data));
		}
	}
}

// Announce updated State
uartControl.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'uartControl::pushState');

	if (!self.serial) {
		return;
	}

	if(self.serial._isOpen) {
		switch (state.status) {
			case 'stop':
				data = [1, 1];
				self.serial.write(createIBusMessage.apply(null, data));
				break;
			case 'pause':
				data = [1, 2];
				self.serial.write(createIBusMessage.apply(null, data));
				break;
			case 'play':
				var data = Buffer.from(state.title, 'utf-8').toJSON().data;
				data = [1, 3].concat(data);
				var duration_h = state.duration >> 8;
				var duration_l = state.duration & 0x00FF;
				data = data.concat([duration_h, duration_l]);
				self.serial.write(createIBusMessage.apply(null, data));
				break;
		}
	}
	return libQ.resolve();
};

uartControl.prototype.test = function(obj) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'uartControl::test');

	var packet = [
		250, 	// Source: imBMW
		0,  	// Fake lenght
		249, 	// Destination: Volumio,
		obj.data3,
		obj.data4,
		0		// Fake CRC
	]
	self.handleData(packet);
};

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