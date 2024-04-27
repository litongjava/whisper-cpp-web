import React, { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { getModelBuffer } from "@/app/utils/openDb";
import { models } from "@/app/constants/models";
import { Button, Col, message, Row, UploadFile } from "antd";
import { ProForm, ProFormRadio } from "@ant-design/pro-components";
import UploadFileItem from "@/components/common/UploadFileItem";
import { UploadProps } from "antd/lib/upload/interface";
import { customEmptyUploadRequest } from "../utils/upload";

const WhisperV2: React.FC = () => {
  const [transcriptionOutput, setTranscriptionOutput] = useState("");
  const [instance, setInstance] = useState<any>(null);
  const [lastModelKey, setLastModelKey] = React.useState("");
  const [modelKey, seModelKey] = React.useState("");
  const audioContextRef = React.useRef<any | undefined>(null);
  const transcriptionOutputRef = React.useRef<any | undefined>(null);
  const [messageApi, messageContextHolder] = message.useMessage();
  const [fileList, setFileList] = React.useState<UploadFile[]>([]);
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

  // useEffect(() => {
  //   if (transcriptionOutputRef.current) {
  //     console.log("textarea is now mounted and ref is set.");
  //   }
  // }, []);

  const print = (text: string) => {
    if (transcriptionOutputRef.current) {
      transcriptionOutputRef.current.value += text + "\n";
    }
  };

  React.useEffect(() => {
    // 加载main.js时会改变Module中的内容,挂载到windows,确保只加载一次
    if (typeof window.Module === "undefined") {
      window.Module = {
        print: print,
        printErr: print,
        setStatus: function (text: any) {
          print(text);
        },
        monitorRunDependencies: function (left: any) {
          // possibly some implementation here
        },
      };
      console.log("Module added to window");
    }
  }, []);

  // Function to start or resume the AudioContext
  const initializeAudioContext = async () => {
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    console.log("AudioContext is active:", audioContextRef.current.state);
  };

  const loadModel = async (modelKey: any) => {
    console.log("modelKey:", modelKey);
    try {
      let modelData = await getModelBuffer(modelKey);

      if (Module && Module.free && instance) {
        Module.free(instance);
        setLastModelKey("");
        console.log("free model:", lastModelKey);
      }
      if (Module && Module.FS_createDataFile) {
        Module.FS_createDataFile(
          "/",
          modelKey,
          new Uint8Array(modelData.data),
          true,
          true
        );
        let newInstance = Module.init(modelKey);
        setInstance(newInstance);
        setLastModelKey(modelKey);
        console.log(
          "Model file loaded into the virtual file system:",
          modelKey
        );
        return newInstance;
      } else {
        console.error(
          "Module not ready or FS_createDataFile is not available."
        );
      }
    } catch (err) {
      console.error("Error loading model:", modelKey, err);
    }
  };

  const handleTranscribe = async (value: any) => {
    console.log("form value:", value);
    let newInstance = instance;

    if (!newInstance) {
      let hide = messageApi.loading("loading model");
      newInstance = await loadModel(value.model);
      hide();
    }
    if (!newInstance) {
      console.log("js: failed to initialize whisper");
    }

    if (fileList.length < 1) {
      console.log("js: no audio File");
      return;
    }

    // 读取音频文件

    let onload = async (event) => {
      const audioData = event.target.result as ArrayBuffer;
      var buf = new Uint8Array(audioData);
      initializeAudioContext();
      audioContextRef.current.decodeAudioData(
        buf.buffer,
        function (audioBuffer: AudioBuffer) {
          let offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
          );
          let source = offlineContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(offlineContext.destination);
          source.start(0);

          offlineContext.startRendering().then(function (renderedBuffer) {
            let audio = renderedBuffer.getChannelData(0);
            console.log("js: audio loaded, size: " + audio.length);

            // truncate to first 30 seconds
            if (audio.length > kMaxAudio_s * kSampleRate) {
              audio = audio.slice(0, kMaxAudio_s * kSampleRate);
              console.log(
                "js: truncated audio to first " + kMaxAudio_s + " seconds"
              );
            }

            // 调用 WASM 模块的 full_default 方法来处理音频
            try {
              // 用于处理音频的函数会自动加载 libmain.worker.js
              // //转写对象,音频数据,语言,线程,是否翻译

              let ret = Module.full_default(newInstance, audio, "en", 8, false);

              setTranscriptionOutput(
                (prevOutput) =>
                  prevOutput +
                  "full_default result code:" +
                  ret +
                  " please wait for translating\n"
              );
            } catch (error) {
              console.error("Error preparing audio data:", error);
            }
          });
        },
        function (e: any) {
          console.log("js: error decoding audio: " + e);
        }
      );
    };

    const reader = new FileReader();
    reader.onload = onload;
    reader.readAsArrayBuffer(fileList[0].originFileObj as Blob);
  };

  const handleChange: UploadProps["onChange"] = ({ fileList: newFileList }) => {
    setFileList(newFileList);
  };

  const handleSubmit = async (value: any) => {
    let hide = messageApi.loading("translaing audio");
    await handleTranscribe(value);
    hide();
  };

  const AudioPlayer = React.memo(({ src }) => {
    return <audio style={{ width: "100%" }} src={src} controls />;
  });

  const audioSrc = React.useMemo(() => {
    return fileList.length > 0
      ? URL.createObjectURL(fileList[0].originFileObj as Blob)
      : "";
  }, [fileList]);

  let form = (
    <ProForm onFinish={handleSubmit} layout="horizontal">
      <ProFormRadio.Group
        name="model"
        label="Model"
        options={Object.keys(models).map((key) => ({ label: key, value: key }))}
        initialValue="base-en-q5_1"
        fieldProps={{
          onChange: (e) => seModelKey(e.target.value),
        }}
      ></ProFormRadio.Group>
      <ProFormRadio.Group
        name="language"
        label="Language"
        options={[
          { label: "auto", value: "auto" },
          { label: "en", value: "en" },
        ]}
        initialValue="en"
      ></ProFormRadio.Group>
      <ProFormRadio.Group
        name="translate"
        label="Translate"
        options={[
          { label: "true", value: true },
          { label: "false", value: false },
        ]}
        initialValue={false}
      ></ProFormRadio.Group>
      <UploadFileItem
        max={1}
        fileList={fileList}
        onChange={handleChange}
        customRequest={customEmptyUploadRequest}
      />
      {/* 音频播放器 */}
      {fileList.length > 0 && (
        <div>
          <audio
            style={{ width: "100%" }}
            src={URL.createObjectURL(fileList[0].originFileObj as Blob)}
            controls
          />
        </div>
      )}
    </ProForm>
  );
  return (
    <>
      {messageContextHolder}
      <div>
        <Script
          src="/js/whisper.cpp/helpers.js"
          strategy="afterInteractive"
          onLoad={() => {
            console.log("helpers脚本加载完毕");
          }}
        />
        <Script
          src="/js/whisper.cpp/main.js"
          strategy="afterInteractive"
          onLoad={() => {
            console.log("main脚本加载完毕");
          }}
        />

        <h1>Audio Transcription App</h1>
        <Row>
          <Col span={8}>{form}</Col>

          <Col span={1}></Col>
          <Col span={15}>
            <textarea
              ref={transcriptionOutputRef}
              style={{
                width: "100%",
                height: "100%",
                fontSize: 20,
              }}
              rows={35}
            ></textarea>
          </Col>
        </Row>
      </div>
    </>
  );
};

export default WhisperV2;
