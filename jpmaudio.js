				
"use strict";

(function() {
 
  
	// players globals
	window.JPM_player = {
		ki : 0,
		sampleRate: 48000,
		leftchannel : Array(),
		rightchannel : Array(),
		recordingLength : 0,
		bufferSize : 0,
		trackon : 1,
		current : 0,
		audiocontext : null,
		audioblob : null,
		uploadAudio : function(){}
	};
 
 var JPMAudioPlayer = function() {
 
 // JPMAudioPlayer lib code constructed by James P. Malloy
 // Copyright (c) 2016 James P. Malloy Some Rights Reserved
 // Some functions found in Public Domain Resourse Communities
 // tested for edge, but edge is missing important context functions like close() etc????????
 // This source code application in whole cannont be used without consent and license to do so
 // Credit must stay intact for legal use
 // questions and/or comments direct to jim@jpmalloy.com
 // alert(navigator.userAgent);
 
	if(/Edge\/|Trident\/|MSIE/i.test(navigator.userAgent)){
		if(!/Edge\/*./i.test(navigator.userAgent)){
			// This is not Microsoft Edge
			window.alert('Microsoft Edge Browser Required for the recorder to work.');
		}
	}

	// getElementById wrapper
	function getById(id){
		return document.getElementById(id);	
	}
 
	// HTML DOM Elements
	var startButton = getById('record-audio');
	var stopButton = getById('stop-recording-audio');
	var audio = getById('audio');
	var playlist = $('#playlist');
	var tracks = 1;
	var audioConstraints = {audio: true, video: false};
	
	var audioStream;
	var recorder;
	var audioblob = undefined;
	//var encoderWorker = new Worker('js/mp3Worker.js');
	
	function playTrack(link, player){

		player.src = link.attr('href');
		var par = link.parent();
		$('#playlist li span.playingnow').remove();
		par.append(' <span class="playingnow" style="color:#fff">On</span>');
		player.volume = 1;
		player.load();
		player.play();
	}
	
	function writeUTFBytes(view, offset, string){ 
	  var lng = string.length;
	  for (var i = 0; i < lng; i++){
		view.setUint8(offset + i, string.charCodeAt(i));
	  }
	}

	function mergeBuffers(channelBuffer, recordingLength){
	  var result = new Float32Array(recordingLength);
	  var offset = 0;
	  var lng = channelBuffer.length;
	  for (var i = 0; i < lng; i++){
		var buffer = channelBuffer[i];
		result.set(buffer, offset);
		offset += buffer.length;
	  }
	  return result;
	}

	function interleave(leftChannel, rightChannel){
	  var length = leftChannel.length + rightChannel.length;
	  var result = new Float32Array(length);

	  var inputIndex = 0;

	  for (var index = 0; index < length; ){
		result[index++] = leftChannel[inputIndex];
		result[index++] = rightChannel[inputIndex];
		inputIndex++;
	  }
	  return result;
	}

	function convertFloat32ToInt16(buffer) {
	  l = buffer.length;
	  buf = new Int16Array(l);
	  while (l--) {
		buf[l] = Math.min(1, buffer[l])*0x7FFF;
	  }
	  return buf.buffer;
	}

	function ab2str(buf) {
	  return String.fromCharCode.apply(null, new Uint16Array(buf));
	}
	
	function encode64(buffer) {
		var binary = '',
			bytes = new Uint8Array( buffer ),
			len = bytes.byteLength;

		for (var i = 0; i < len; i++) {
			binary += String.fromCharCode( bytes[ i ] );
		}
		return window.btoa( binary );
	}
	
	function Uint8ArrayToFloat32Array(u8a){
		var f32Buffer = new Float32Array(u8a.length);
		for (var i = 0; i < u8a.length; i++) {
			var value = u8a[i<<1] + (u8a[(i<<1)+1]<<8);
			if (value >= 0x8000) value |= ~0x7FFF;
			f32Buffer[i] = value / 0x8000;
		}
		return f32Buffer;
	}
	
	function recorderProcess(e) {
		//console.log('recording');
		// get both channels
		var left = e.inputBuffer.getChannelData (1); // 0
		var right = e.inputBuffer.getChannelData (1); // 1
		// we clone the samples
		JPM_player.leftchannel.push (new Float32Array (left));
		JPM_player.rightchannel.push (new Float32Array (right));
		JPM_player.recordingLength += 2048;
		//console.log(JPM_player.recordingLength);	
		if(JPM_player.recordingLength > 8192){
			
			//console.log(JPM_player.recordingLength);
			//return false;
		}
		//var buf = convertFloat32ToInt16(left);
		//bytes = ab2str(left);
		//document.getElementById('data').innerHTML = left;
		// console.log(convertFloat32ToInt16(left));
	}

	// save audio 
	
	JPM_player.uploadAudio = function (name) {
	
	var blob = JPM_player.audioblob;
	//console.log(blob);
	jpmbox.loadContent('<h2>Saving File</h2>Saving audio to file manger...please wait.');
	if(blob){
	  var reader = new FileReader();
	  reader.onload = function(event){
		var fd = {};
		fd["fname"] = name;
		fd["data"] = event.target.result;
		$.ajax({
		  type: 'POST',
		  url: 'index.php?page=audio&json=true',
		  data: fd,
		  dataType: 'text'
		}).done(function(data) {
			jpmbox.loadContent(data);
		});
	  };
	  reader.readAsDataURL(blob);
	  }
	}
	
	// thanks to http://jsdo.it/Masashi.Yoshikawa/wav2mp3byJS
	function parseWav(wav) {
		function readInt(i, bytes) {
			var ret = 0,
				shft = 0;

			while (bytes) {
				ret += wav[i] << shft;
				shft += 8;
				i++;
				bytes--;
			}
			return ret;
		}
		if (readInt(20, 2) != 1) throw 'Invalid compression code, not PCM';
		//if (readInt(22, 2) != 1) throw 'Invalid number of channels, not 1 '+ readInt(22, 2);
		return {
			sampleRate: readInt(24, 4),
			bitsPerSample: readInt(34, 2),
			samples: wav.subarray(44)
		};
	}
	
	function encodeMP3(blob){

		//experimental
	  var reader = new FileReader();
	  reader.onload = function(event){
		var arrayBuffer = event.target.result;
		var buffer2 = new Uint8Array(arrayBuffer);
		data = parseWav(buffer2);
        console.log(data);
		
		console.log('encoding...');
        encoderWorker.postMessage({ cmd: 'init', config:{
            mode : 3,
			channels:1,
			samplerate: data.sampleRate,
			bitlate: data.bitsPerSample
        }});

        encoderWorker.postMessage({ cmd: 'encode', buf: Uint8ArrayToFloat32Array(data.samples) });
        encoderWorker.postMessage({ cmd: 'finish'});
        encoderWorker.onmessage = function(e) {
		
            if (e.data.cmd == 'data') {
                console.log('done');
				
				//var mp3Blob = 'data:audio/mp3;base64,'+encode64(e.data.buf);
				//console.log( 'data:audio/mp3;base64,'+encode64(e.data.buf));
				var mp3Blob = new Blob([new Uint8Array(e.data.buf)], {type: 'audio/mp3'});
            }	
			
			 };
	  };
	  reader.readAsArrayBuffer(blob); //readAsDataURL  
	}
	
	function htmlResults(blob)
	{
		//var a = document.createElement("a");
		//a.innerHTML = 'testing wav';
		//document.body.appendChild(a);
		// a.style = "display: none";
		// stream
		var blobd = window.URL.createObjectURL(blob); // wav blob or mp3
	   
		//window.setTimeout(function(){},1000);

		var url = blobd;
		var trackon = JPM_player.trackon;
		playlist.css({"display":"block"});
		
		//$('.tracklink.active').removeClass('active');
		//$('.downloadlink.active').removeClass('active');
		//$('.tracklink').addClass('nonactive');
		//$('.downloadlink').addClass('nonactive');
		
		$('#playlist li span.playingnow').remove();
		playlist.prepend('<li><a href="'+url+'" class="tracklink" id="track'+trackon+'">Play Track '+trackon+'</a> | <a href="'+url+'" download="Track '+trackon+'.wav" class="downloadlink">Download</a> | <a href="javascript:void(0)" onclick="JPM_player.uploadAudio(\'Track '+trackon+'.wav\')" class="downloadlink" title="Save / Share">Save</a> <span class="playingnow" style="color:#fff">On</span></li>');
		
		$('#playlist li #track'+trackon+'').click(function(e){
		
			e.preventDefault();
			var link = $(this);
			JPM_player.current = link.parent().index();
			playTrack(link, audio);
			
		});
		
		audio.muted = false;
		audio.src = blobd;
		JPM_player.audioblob = blob;
		//audio.play();
		//uploadAudio(blob);
		JPM_player.trackon++;
		//a.href = url;
		//a.download = 'test.wav';	
		//a.click();
		//JPM_player.URL.revokeObjectURL(url);	
	
	}
	
	// creates wav from stream
	function createWav() {

		// we flat the left and right channels down
		var leftBuffer = mergeBuffers ( JPM_player.leftchannel, JPM_player.recordingLength );
		var rightBuffer = mergeBuffers ( JPM_player.rightchannel, JPM_player.recordingLength );
		// we interleave both channels together
		var interleaved = interleave ( leftBuffer, rightBuffer );

		// create the buffer and view to create the .WAV file
		var buffer = new ArrayBuffer(44 + interleaved.length * 2);
		var view = new DataView(buffer);

		// write the WAV container, check spec at: https://ccrma.stanford.edu/courses/422/projects/WaveFormat/
		// RIFF chunk descriptor
		writeUTFBytes(view, 0, 'RIFF');
		view.setUint32(4, 44 + interleaved.length * 2, true); //44 32
		writeUTFBytes(view, 8, 'WAVE'); //WAVE
		// FMT sub-chunk
		writeUTFBytes(view, 12, 'fmt ');
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true);
		// stereo (2 channels)
		view.setUint16(22, 2, true);
		view.setUint32(24, JPM_player.sampleRate, true);
		view.setUint32(28, JPM_player.sampleRate * 4, true);
		view.setUint16(32, 4, true);
		view.setUint16(34, 16, true);
		// data sub-chunk
		writeUTFBytes(view, 36, 'data');
		view.setUint32(40, interleaved.length * 2, true);

		
		// write the PCM samples
		//view = floatTo16BitPCM( view, 44, interleaved );
		
		
		var lng = interleaved.length;
		var index = 44;
		var volume = 1;
		for (var i = 0; i < lng; i++){
			view.setInt16(index, interleaved[i] * (0x7FFF * volume), true);
			index += 2;
		}
		
		// our final binary blob that we can hand off	
		var blob = new Blob ( [ view ], { type : 'audio/wav' } ); // audio/mpeg etc
		
		/* test
	  var reader = new FileReader();
	  reader.onload = function(event){
		var arrayBuffer = event.target.result;
		var buffer2 = new Uint8Array(arrayBuffer);
		var data = parseWav(buffer2);
        console.log(data);
		
	 };
	  reader.readAsArrayBuffer(blob); //readAsDataURL  
	  */
	  
		JPM_player.ki = 0;
		JPM_player.sampleRate = 48000;
		JPM_player.leftchannel = Array();
		JPM_player.rightchannel = Array();
		JPM_player.recordingLength = 0;
		JPM_player.bufferSize = 0;
		JPM_player.current = 0;
		JPM_player.audiocontext = null;
		JPM_player.audiocontext = undefined;
	  
		htmlResults(blob);
		
	}
	
	function isRecording(){
		
		startButton.innerHTML = 'Recording...';
		startButton.style.color = 'red';
		startButton.disabled = true;
		stopButton.disabled = false;
		
	}
	
	function floatTo16BitPCM( output, offset, input ) {
		for ( var i = 0; i < input.length; i++, offset += 2 ) {
			var s = Math.max( -1, Math.min( 1, input[ i ] ) );
			output.setInt16( offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true );
		}
		return output;
	}
	
	function createContext(stream) {
	
		try {
			var audioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;
			isRecording();
			
		}catch (e) {
			
			alert('Your browser does not support AudioContext, please update your browser.');
			return;
		}
		console.log(audioContext);
		var context = new audioContext();
		JPM_player.audiocontext = context;

		// retrieve the current sample rate to be used for WAV packaging
		JPM_player.sampleRate = context.sampleRate;
			
		// creates a gain node
		var volume = context.createGain();

		// creates an audio node from the microphone incoming stream
		var audioInput = context.createMediaStreamSource(stream);

		// connect the stream to the gain node
		audioInput.connect(volume);

		/* From the spec: This value controls how frequently the audioprocess event is 
			dispatched and how many sample-frames need to be processed each call. 
			Lower values for buffer size will result in a lower (better) latency. 
			Higher values will be necessary to avoid audio breakup and glitches */
		var bufferSize = 2048;
		recorder = context.createScriptProcessor(bufferSize, 2, 2);
			
		recorder.onaudioprocess = recorderProcess;

		//recorder.onaudioprocess = function(e){}

		// we connect the recorder
		volume.connect (recorder);
		recorder.connect (context.destination);
	
	}
	
	startButton.onclick = function() {
				
		JPM_player.device = null;

		startButton.innerHTML = 'Allow access';
		
		// need to check to make sure user has access to webcam audio etc first
		// for IE/edge
		if(window.navigator.getUserMedia) {
		
			if(!navigator.mediaDevices.getUserMedia){
			
				alert('Your web browser does not support HTML5 audio recording. Please update your browser.');
				return;
			}
		
			if(!JPM_player.device){
				
				JPM_player.device = navigator.mediaDevices.getUserMedia(audioConstraints);
				
				JPM_player.device.then(function(stream) {	

						createContext(stream);						
				});			
				JPM_player.device.catch(function(err) { console.log(err.name);

				alert('Problem: Could not connect to stream. Please make sure you have allowed webcam or audio access in your browsers settings.');
				return;

				});
			}
				
		} else if(window.navigator.webkitGetUserMedia) {
	
			if(!JPM_player.device){
				JPM_player.device = navigator.webkitGetUserMedia(audioConstraints,function(stream) {
					
					createContext(stream);
					
					
				},function(err){console.log(err.name);
				
					alert('Problem: Could not connect to stream. Please make sure you have allowed webcam or audio access in your browsers settings.');
					return;
				
				})
			}
				
		} else if(window.navigator.mozGetUserMedia || navigator.mediaDevices.getUserMedia) {	
			
			if(!JPM_player.device){
				if(navigator.mediaDevices){
				
					JPM_player.device = navigator.mediaDevices.getUserMedia(audioConstraints);
					JPM_player.device.then(function(stream) {			
						createContext(stream);
					});			
					JPM_player.device.catch(function(err) { console.log(err.name);

						alert('Problem: Could not connect to stream. Please make sure you have allowed webcam or audio access in your browsers settings.');
						return;

					});
					
				}else {
					JPM_player.device = navigator.mozGetUserMedia(audioConstraints,function(stream) {
					
					createContext(stream);
					
					},function(err){console.log(err.name);
					
						alert('Problem: Could not connect to stream. Please make sure you have allowed webcam or audio access in your browsers settings.');
						return;
					
					});
				}
			}
		}else {
		
				alert('Your web browser does not support HTML5 audio recording. Please update your browser.');
				return;
		}
		
		JPM_player.isAudio = true;
	};

	// stop recording
	stopButton.onclick = function() {
		
		if(JPM_player.audiocontext){
			
			console.log('recorder stopped');
			startButton.disabled = false;
			startButton.innerHTML = 'Record';
			startButton.style.color = '#000';
			this.disabled = true;
			
			//console.log(audio);
			//audio.src = '';
			if(JPM_player.audiocontext.close){
				// important closes audio data
				JPM_player.audiocontext.close();
			}else {
				//alert('in ' + JPM_player.recordingLength);
			}
			recorder.disconnect(JPM_player.audiocontext.destination);
			createWav();
		}
	};
 
  return {
    print: function() {
      console.log(value);
    },
	createWav : function() {createWav},
	uploadAudio : function(audio) {uploadAudio(audio)}
  }
}

JPMAudioPlayer();

})();
