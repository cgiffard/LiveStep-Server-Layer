// Configuration
	
	var configuration = {
		storeCount: 3,
		timeSteps: 8,
		globalBPM: 160,
		beatsPerMeasure: 4
	}
	
	var state = {
		stores: [],
		stepCount: 0,
		beatCount: 0,
		clock: 0,
		media: [],
		clients: []
	};

// Dependencies

	var net		= require("net"),
		sys		= require("sys"),
		path	= require("path"),
		http	= require("http"),
		fs		= require("fs"),
		io		= require("/usr/local/lib/node/socket.io");
	
	Array.prototype.exists = function(string) {
		for(key in this) {
			if (this[key] == string) {
				return key;
			}
		}
		
		return -1;
	}
	
	Array.prototype.remove = function(from, to) {
		var rest = this.slice((to || from) + 1 || this.length);
		this.length = from < 0 ? this.length + from : from;
		return this.push.apply(this, rest);
	};
	
// Initialise Stores and Media Bin

	state.media = fs.readdirSync("./resources");
	
	for (var storeCount = 0; storeCount < configuration.storeCount; storeCount ++) {
		var TmpStoreArray = [];
		for (var stepCount = 0; stepCount < configuration.timeSteps; stepCount ++) {
			TmpStoreArray.push([Math.floor(Math.random()*22)]);
		}
		
		state.stores.push(TmpStoreArray);
	}	

// Socket to Presentation Layer

// Resource Server
	
	server = http.createServer(function(req, res){
		console.log("new request for: ",req.url);
		if (state.media.exists(req.url.replace(/\//,"")) >= 0) {
			MediaFile = state.media[state.media.exists(req.url.replace(/\//,""))].toString();
			FileData = fs.readFileSync("./resources/" + MediaFile);
			
			if (MediaFile.match(".ogg")) {
				res.writeHead("Content-type", "audio/ogg");
			} else {
				res.writeHead("Content-type", "video/mp4");
			}
			
			console.log("downloading resource");
			console.log(FileData.length);
			res.write(FileData);
			console.log("Resource downloaded");
			res.end();
		} else {
			res.writeHead("Content-type", "text/json");
			res.write(JSON.stringify(state.media));
			res.end();
		}
	}).listen(4000);
	
// Timer
	
	function play() {
		console.log("configuring timer at: ",Math.floor((1000*60)/configuration.globalBPM),"ms");
		state.MainTimer = setInterval(function() {
			sendClock(state.beatCount,state.stepCount,state.clock);
			
			if (state.beatCount == 0) {
				runSequence(state.beatCount,state.stepCount,state.clock);
			}
			
			// Update beatcount and step counts
			if (state.beatCount == configuration.beatsPerMeasure -1) {
				state.stepCount = state.stepCount < configuration.timeSteps - 1 ? state.stepCount + 1 : 0;
			}
			
			state.beatCount = state.beatCount < configuration.beatsPerMeasure -1 ? state.beatCount + 1 : 0;
			state.clock ++;
		},Math.floor((1000*60)/configuration.globalBPM));
	}
	
	function pause() {
		console.log("pausing clock...");
		clearInterval(state.MainTimer);
	}
	
	function stop() {
		pause();
		
		state.beatCount = 0;
		state.stepCount = 0;
		state.clock = 0;
		
		console.log("stopped clock");
	}

// Sequencer

	function runSequence(beat,step,clock) {
		// Send to corresponding client
		var sentThisStep = []
		
		for (client in state.clients) {
			if (typeof(state.clients[client]) == "object") {
				if (state.stores[client][step]) {
					console.log(state.stores[client][step]);
					for (channel in state.stores[client][step]) {
						if (typeof(state.stores[client][step]) != "function") {
							if (sentThisStep.exists(parseInt(state.stores[client][step])) == -1) {
								PL_sendPlayRequest(client,parseInt(state.stores[client][step]));
								sentThisStep.push(parseInt(state.stores[client][step]));
								console.log("adding " + parseInt(state.stores[client][step]) + " to sentthisstep");
								console.log("Sending play request to client " + client + " with media id " + parseInt(state.stores[client][step]));
							} else {
								console.log("resource " + parseInt(state.stores[client][step]) + " already sent");
							}
						}
					}
				}
			}
		}
	}

// Send Clock

	function sendClock(beat,step,clock) {
		for (clientID in state.clients) {
			if (state.clients.length != 0) {
				if (typeof(state.clients[clientID]) == "object") {
					state.clients[clientID].send(JSON.stringify({beat:beat,step:step,clock:clock}));
				}
			}
		}
	}

// Trigger Resource

	function PL_sendBufferRequest(clientID,mediaID) {
		if (state.media[mediaID]) {
			// {command:"buffer",path:"http://crunktown.local:9023/1237868.wav",id:1234}
			state.clients[clientID].send(JSON.stringify({command:"buffer",id:mediaID,path:state.media[mediaID]}));
		} else {
			console.log("Media ID doesn't correspond to an actual media item");
		}
	}
	
	function PL_sendPlayRequest(clientID,mediaID) {
		if (state.media[mediaID]) {
			// {command:"play",id:1234,type:"video"}
			console.log(JSON.stringify({command:"play",id:mediaID}));
			if (typeof(state.clients[clientID]) == "object") {
				state.clients[clientID].send(JSON.stringify({command:"play",id:mediaID}));
			}
		} else {
			console.log("Media ID doesn't correspond to an actual media item");
		}
	}

// Handle Exit conditions

	process.on('SIGINT', function () {
		console.log("Stopping and closing connections");
		stop();
		server.close();
	});
	
	
	




// Let's get cracking

	play();
	
	
	
	
	server = http.createServer(function(req, res){});
	
	var socket = io.listen(server);
	
	socket.on('connection', function(client){
		client.on('message', function(RPCCall){
			/*
			console.log(this.time);
			console.log(RPCCall);
			console.log(typeof(RPCCall));
			*/
			try {
				console.log("attempting to parse");
				RPCCallParsed = JSON.parse(RPCCall);
				console.log(RPCCallParsed);
			} catch(e) {
				console.log(e);
				if (typeof(RPCCall) == "object") {
					RPCCallParsed = RPCCall;
				} else {
					return false;
				}
			}
			/* console.log(RPCCallParsed); */
			
			if (RPCCallParsed.command == "play") {
				play();
				
			} else if(RPCCallParsed.command == "pause") {
				pause();
				
			} else if(RPCCallParsed.command == "stop") {
				stop();
				
			} else if(RPCCallParsed.command == "clientRegister") {
				this.type = RPCCallParsed.type;
				
				compositeMediaArray = [];
				for (mediaItem = 0; mediaItem < state.media.length; mediaItem ++) {
					if (state.media[mediaItem].toString().match(".ogg") && this.type == "audio") {
						compositeMediaArray.push({"id":mediaItem,"name":state.media[mediaItem].toString(),type:"audio"});
					} else if (state.media[mediaItem].toString().match(".m4v") && this.type == "video") {
						compositeMediaArray.push({"id":mediaItem,"name":state.media[mediaItem].toString(),type:"video"});
					}
				}
				
				this.send(JSON.stringify({command:"mediaset","media":compositeMediaArray}));
			} else if (RPCCallParsed.command == "select") {
				console.log("Received a select request from client " + this.id + " for step " + RPCCallParsed.step + " with media id " + RPCCallParsed.mediaid);
				console.log(state.media[parseInt(RPCCallParsed.mediaid)]);
				if (state.media[parseInt(RPCCallParsed.mediaid)]) {
					console.log("Media seems to exist!");
					if (state.stores[parseInt(this.id)]) {
						if (state.stores[parseInt(this.id)][parseInt(RPCCallParsed.step)]) {
							state.stores[parseInt(this.id)][parseInt(RPCCallParsed.step)].push(parseInt(RPCCallParsed.mediaid));
							console.log(state.stores[parseInt(this.id)][parseInt(RPCCallParsed.step)]);
						} else {
							console.log("STEP ID " + parseInt(RPCCallParsed.step) + " COULD NOT BE FOUND");
						}
					} else {
						console.log("STORE ID " + this.id + " COULD NOT BE FOUND");
					}
				} else {
					console.log("MEDIA ID " + RPCCallParsed.mediaid + " COULD NOT BE FOUND");
				}
				
				console.log(state.stores);
			} else if (RPCCallParsed.command == "deselect") {
/* 				{action:"deselect",mediaid:1234,step:3,channel:2} */
				if (state.stores[this.id]) {
					if (state.stores[this.id][RPCCallParsed.step]) {
						console.log("SCANNNG STORE " + this.id + ", step " + RPCCallParsed.step + " for mediaid: " + RPCCallParsed.mediaid)
						for(mediaID in state.stores[this.id][RPCCallParsed.step]) {
							if (state.stores[this.id][RPCCallParsed.step][mediaID] == RPCCallParsed.mediaid) {
								state.stores[this.id][RPCCallParsed.step].remove(mediaID);
							}
						}
					} else {
						console.log("STORE ID " + this.id + ", STEP " + RPCCallParsed.step + " COULD NOT BE FOUND");
					}
				} else {
					console.log("STORE ID " + this.id + " COULD NOT BE FOUND");
				}
				
				console.log(state.stores);
			}
		});
		
		client.on('disconnect', function(){
			console.log("disconnected client id",this.id);
			state.clients.remove(this.id);
		});
		
		client.time = (new Date).getTime();
		
		client.id = state.clients.length;
		state.clients.push(client);
	});
	
	server.listen(8080);


// debug {

	setInterval(function() {
		console.log(state.stores);
	},5000);


// }