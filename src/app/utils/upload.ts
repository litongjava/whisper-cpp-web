export async function customEmptyUploadRequest(options: any) {
  const {file, onSuccess, onError} = options;
  onSuccess({}, file);
}