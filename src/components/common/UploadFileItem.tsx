import {Form, Image, message, Upload} from "antd";
import React, {useState} from "react";
import {RcFile, UploadFile} from "antd/lib/upload/interface";
import {PlusOutlined, UploadOutlined} from "@ant-design/icons";
import {UploadChangeParam} from "antd/es/upload/interface";
import PasteUpload from "@/components/common/PasteUpload";

type UploadImageProps = {
  label?: any
  name?: string
  max?: number
  fileList: UploadFile[]
  onChange?: (info: UploadChangeParam<UploadFile>) => void;
  customRequest?: (options: any) => void;
};


const normFile = (e: any) => {
  if (Array.isArray(e)) {
    return e;
  }
  return e?.fileList;
};

const UploadFileItem: React.FC<UploadImageProps> = ({label, name, max, fileList, onChange, customRequest}) => {

  const [messageApi, contextHolder] = message.useMessage();

  const [previewImage, setPreviewImage] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const getBase64 = (file: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  const handlePreview = async (file: UploadFile) => {
    if (!file.url && !file.preview) {
      file.preview = await getBase64(file.originFileObj as Blob);
    }
    setPreviewImage(file.url || (file.preview as string));
    setPreviewOpen(true);
  };

  const uploadButton = (
    <div>
      <PlusOutlined/>
      <div style={{marginTop: 8}}>Upload</div>
    </div>
  );

  const onPasteFile = async (items: DataTransferItem[]) => {
    for (let i = 0; i < items.length; i++) {

      const file: File | null = items[i].getAsFile();
      if (file) {
        const hide = messageApi.loading("uploading....");
        const uploadFile: UploadFile = {
          uid: new Date().getTime() + "",
          name: file.name,
          status: 'uploading',
          type: file.type,
          size: file.size,
          originFileObj: file as RcFile,
        };


        if (customRequest) {
          let options = {
            file,
            onSuccess: (response: any, file: any) => {
              uploadFile.status = 'done'; // 根据响应更新状态
              uploadFile.response = response;
              const newFileList = [...fileList, uploadFile];
              hide();
              // 触发 onChange
              if (onChange) {
                let info: UploadChangeParam<UploadFile> = {
                  file: uploadFile,
                  fileList: newFileList,
                };
                onChange(info);
              }
            },
            onError: (err: any) => {
              uploadFile.status = 'error'; // 更新错误状态
              console.error('Upload failed:', err);
              hide();
            }
          };

          customRequest(options);

        }
      }
    }
  }


  return (
    <>
      {contextHolder}
      <Form.Item label={label} valuePropName={name} getValueFromEvent={normFile}>
        <Upload
          listType="picture-card"
          fileList={fileList}
          onPreview={handlePreview}
          onChange={onChange}
          customRequest={customRequest}
        >
          {fileList.length >= (max ? max : 8) ? null : uploadButton}
        </Upload>
        {fileList.length >= (max ? max : 8) ? null : <PasteUpload onPasteFile={onPasteFile}/>}
      </Form.Item>


      {
        previewImage && (
          <Image
            wrapperStyle={{display: 'none'}}
            preview={{
              visible: previewOpen,
              onVisibleChange: setPreviewOpen,
              afterOpenChange: (visible) => !visible && setPreviewOpen(false),
            }}
            src={previewImage}
          />
        )
      }
    </>
  )

}
export default UploadFileItem
