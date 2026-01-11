import api from './api';

export const uploadToS3 = async (file: File): Promise<string | null> => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.fileUrl;
  } catch (error) {
    console.error('Error uploading file:', error);
    return null;
  }
};
