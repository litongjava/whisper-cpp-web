import React from "react";

type PasteUploadProps = {
  onPasteFile?: (files: DataTransferItem[]) => void;
}
const PasteUpload: React.FC<PasteUploadProps> = ({onPasteFile}) => {
  const handlePaste = (event: any) => {
    console.log("onPasteFile:", onPasteFile)
    const items: DataTransferItem[] = (event.clipboardData || event.originalEvent.clipboardData).items;
    onPasteFile && onPasteFile(items);
  };

  return <input onPaste={handlePaste} placeholder="Paste file here" size={10}/>;
};

export default PasteUpload;
