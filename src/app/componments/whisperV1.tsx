import React, {useState} from 'react';
import Script from "next/script";
import {getModelBuffer} from "@/app/utils/openDb";
import {models} from "@/app/constants/models";

const WhisperV1 = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptionOutput, setTranscriptionOutput] = useState('');
  const [instance, setInstance] = useState<any>(null);
  const [lastModelKey, setLastModelKey] = React.useState('')
  const audioContextRef = React.useRef<any | undefined>(null);


  const kSampleRate = 16000;
  const kMaxAudio_s = 30 * 60;


  React.useEffect(() => {
    // Setup the audio context only once and reuse it
    let contextOptions = {
      sampleRate: kSampleRate,
      channelCount: 1,
      echoCancellation: false,
      autoGainControl: true,
      noiseSuppression: true,
    };

    audioContextRef.current = new AudioContext(contextOptions);
  }, []);

  React.useEffect(() => {
    const print = (text) => {
      setTranscriptionOutput((prevOutput) => prevOutput + text + '\n');
    };
    // 加载main.js时会改变Module中的内容,挂载到windows,确保只加载一次
    if (typeof window.Module === "undefined") {
      window.Module = {
        print: print,
        printErr: print,
        setStatus: function (text) {
          print('js: ' + text);
        },
        monitorRunDependencies: function (left) {
          // possibly some implementation here
        }
      };
      console.log("Module added to window");
    }

  }, [])


  // Function to start or resume the AudioContext
  const initializeAudioContext = async () => {
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    console.log('AudioContext is active:', audioContextRef.current.state);
  };


  const loadModel = async (modelKey) => {

    try {
      let modelData = await getModelBuffer(modelKey);

      if (Module && Module.free && instance) {
        Module.free(instance);
        setLastModelKey("");
        console.log("free model:", lastModelKey);
      }
      if (Module && Module.FS_createDataFile) {
        Module.FS_createDataFile('/', modelKey, new Uint8Array(modelData.data), true, true);
        let newInstance = Module.init(modelKey);
        setInstance(newInstance);
        setLastModelKey(modelKey)
        console.log("Model file loaded into the virtual file system:", modelKey);
      } else {
        console.error("Module not ready or FS_createDataFile is not available.");
      }
    } catch (err) {
      console.error("Error loading model:", modelKey, err);
    }
  };


  const handleAudioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target?.files ? event.target?.files[0] : null;
    setAudioFile(file);
  };

  const handleTranscribe = async () => {
    let newInstance = instance
    if (!newInstance) {
      console.log("js: failed to initialize whisper");
      return;
    }

    if (!audioFile) {
      console.log("js: no audio File");
      return;
    }


    // 读取音频文件

    let onload = async (event) => {
      const audioData = event.target.result as ArrayBuffer;
      var buf = new Uint8Array(audioData);
      initializeAudioContext()
      audioContextRef.current.decodeAudioData(buf.buffer, function (audioBuffer) {
        let offlineContext = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
        let source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start(0);

        offlineContext.startRendering().then(function (renderedBuffer) {
          let audio = renderedBuffer.getChannelData(0);
          console.log('js: audio loaded, size: ' + audio.length);

          // truncate to first 30 seconds
          if (audio.length > kMaxAudio_s * kSampleRate) {
            audio = audio.slice(0, kMaxAudio_s * kSampleRate);
            console.log('js: truncated audio to first ' + kMaxAudio_s + ' seconds');
          }


          // 调用 WASM 模块的 full_default 方法来处理音频
          try {
            // 用于处理音频的函数会自动加载 libmain.worker.js
            // //转写对象,音频数据,语言,线程,是否翻译
            let ret = Module.full_default(newInstance, audio, 'en', 8, false);
            console.log(ret)
          } catch (error) {
            console.error("Error preparing audio data:", error);
          }
        });
      }, function (e) {
        console.log('js: error decoding audio: ' + e);
      });
    };

    const reader = new FileReader();
    reader.onload = onload;
    reader.readAsArrayBuffer(audioFile);

  };

  return (
    <section>
      <Script
        src="/js/whisper.cpp/helpers.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log('helpers脚本加载完毕');
        }}
      />
      <Script
        src="/js/whisper.cpp/main.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log('main脚本加载完毕');
        }}
      />


      <h1>Audio Transcription App</h1>
      <div>
        <label htmlFor="audioFile">Select audio file to transcribe:</label>
        <input type="file" id="audioFile" name="audioFile" onChange={handleAudioChange}/>
      </div>
      <div>
        {Object.entries(models).map(([key, value]) => (
          <button key={key} onClick={() => loadModel(key)}>{key}&nbsp;</button>
        ))}
      </div>
      <button onClick={handleTranscribe}>Transcribe</button>
      <br/>
      <textarea value={transcriptionOutput} readOnly rows={10} cols={100}/>
    </section>
  );
};

export default WhisperV1
