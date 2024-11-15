/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Type, Mic, Save, X, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const VideoEditor = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [activeTab, setActiveTab] = useState('voiceover');
  const [textOverlays, setTextOverlays] = useState([
    { text: '', startTime: 0, duration: 2, x: 100, y: 100 }
  ]);
  const [audioSegments, setAudioSegments] = useState<Array<{
    file: File | null;
    delay: number;
    previewUrl?: string;
  }>>([
    { file: null, delay: 0 }
  ]);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleVideoUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleAudioUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setAudioSegments(prev => {
        const newSegments = [...prev];
        newSegments[index] = { ...newSegments[index], file, previewUrl };
        return newSegments;
      });
    }
  };

  const addAudioSegment = () => {
    setAudioSegments(prev => [...prev, { file: null, delay: 0 }]);
  };

  const removeAudioSegment = (index: number) => {
    setAudioSegments(prev => {
      if (prev[index].previewUrl) {
        URL.revokeObjectURL(prev[index].previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const addTextOverlay = () => {
    setTextOverlays(prev => [...prev, { text: '', startTime: 0, duration: 2, x: 100, y: 100 }]);
  };

  const removeTextOverlay = (index: any) => {
    setTextOverlays(prev => prev.filter((_, i) => i !== index));
  };

  const updateTextOverlay = (index: any, field: any, value: any) => {
    setTextOverlays(prev => {
      const newOverlays = [...prev];
      if (['startTime', 'duration', 'x', 'y'].includes(field)) {
        const numericValue = value === '' || isNaN(value) ? 0 : value;
        newOverlays[index] = { ...newOverlays[index], [field]: numericValue };
      } else {
        newOverlays[index] = { ...newOverlays[index], [field]: value };
      }
      return newOverlays;
    });
  };

  const removeVideo = () => {
    setVideoFile(null);
    setVideoPreviewUrl('');
    setTextOverlays([{ text: '', startTime: 0, duration: 2, x: 100, y: 100 }]);
    setAudioSegments([{ file: null, delay: 0 }]);
  };

  async function handleProcess() {
    if (!videoFile) {
      setError('Please upload a video first');
      return;
    }

    setIsProcessing(true);
    try {
      if (audioSegments.some(segment => segment.file)) {
        const formData = new FormData();
        formData.append('video', videoFile);

        audioSegments.forEach((segment, index) => {
          if (segment.file) {
            formData.append(`audio_${index}`, segment.file);
            formData.append(`delay_${index}`, segment.delay.toString());
          }
        });

        const voiceoverResponse = await fetch('http://localhost:5000/api/add-voiceover', {
          method: 'POST',
          body: formData,
        });

        if (!voiceoverResponse.ok) {
          const errorData = await voiceoverResponse.json().catch(() => null);
          throw new Error(errorData?.message || `HTTP error! status: ${voiceoverResponse.status}`);
        }

        const voiceoverBlob = await voiceoverResponse.blob();
        await downloadProcessedVideo(voiceoverBlob, videoFile.name);
      }

      if (textOverlays.some(overlay => overlay.text.trim())) {
        const formData = new FormData();
        formData.append('video', videoFile);

        const textData = textOverlays
          .filter(overlay => overlay.text.trim())
          .map(overlay => ({
            text: overlay.text,
            start_time: overlay.startTime,
            duration: overlay.duration,
            position: [overlay.x, overlay.y]
          }));

        formData.append('text_data', JSON.stringify(textData));

        const textResponse = await fetch('http://localhost:5000/api/add-text-overlay', {
          method: 'POST',
          body: formData,
        });

        if (!textResponse.ok) {
          const errorData = await textResponse.json().catch(() => null);
          throw new Error(errorData?.message || `HTTP error! status: ${textResponse.status}`);
        }

        const textBlob = await textResponse.blob();
        await downloadProcessedVideo(textBlob, videoFile.name);
      }

    } catch (error) {
      console.error('Processing error:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  }

  const downloadProcessedVideo = async (blob: Blob, originalFileName: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `processed_${originalFileName}`;

    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  useEffect(() => {
    return () => {
      audioSegments.forEach(segment => {
        if (segment.previewUrl) {
          URL.revokeObjectURL(segment.previewUrl);
        }
      });
    };
  }, [audioSegments]);

  return (
    <div className="max-w-5xl mx-auto p-10">
      <h1 className='absolute top-5 tracking-wide left-10 text-center text-black font-semibold text-2xl'>mochi.</h1>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload size={24} /> Upload Video
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4">
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
              id="video-upload"
            />
            <label
              htmlFor="video-upload"
              className="w-full h-40 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-50 relative"
            >
              {videoPreviewUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoPreviewUrl}
                    className="max-h-full"
                    controls
                  />
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      removeVideo();
                    }}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              ) : (
                <div className="text-center">
                  <Upload className="mx-auto mb-2" />
                  <span>Click to upload video</span>
                </div>
              )}
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('voiceover')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            activeTab === 'voiceover' ? 'bg-black text-white' : 'bg-gray-100'
          }`}
        >
          <Mic size={20} /> Voiceover
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            activeTab === 'text' ? 'bg-black text-white' : 'bg-gray-100'
          }`}
        >
          <Type size={20} /> Text Overlay
        </button>
      </div>

      {activeTab === 'voiceover' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add Voiceover Segments</CardTitle>
          </CardHeader>
          <CardContent>
            {audioSegments.map((segment, index) => (
              <div key={index} className="mb-6 p-4 border rounded-lg bg-gray-50">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-medium">Audio Segment {index + 1}</h3>
                  <button
                    onClick={() => removeAudioSegment(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-full"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Audio File
                    </label>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => handleAudioUpload(index, e)}
                      className="w-full p-2 border rounded bg-white"
                    />
                    {segment.file && (
                      <div className="mt-2 space-y-2">
                        <p className="text-sm text-gray-500">
                          Selected: {segment.file.name}
                        </p>
                        {segment.previewUrl && (
                          <audio
                            controls
                            className="w-full h-8"
                            src={segment.previewUrl}
                          >
                            Your browser does not support the audio element.
                          </audio>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Delay
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={segment.delay || 0}
                        onChange={(e) => {
                          const newSegments = [...audioSegments];
                          const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          newSegments[index].delay = value;
                          setAudioSegments(newSegments);
                        }}
                        className="w-32 p-2 border rounded bg-white"
                      />
                      <span className="text-sm text-gray-500">seconds</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={addAudioSegment}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 w-full justify-center"
            >
              <Plus size={20} /> Add Audio Segment
            </button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'text' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add Text Overlays</CardTitle>
          </CardHeader>
          <CardContent>
            {textOverlays.map((overlay, index) => (
              <div key={index} className="mb-6 p-4 border rounded-lg bg-gray-50">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-medium">Text Overlay {index + 1}</h3>
                  <button
                    onClick={() => removeTextOverlay(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-full"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Overlay Text
                    </label>
                    <input
                      type="text"
                      placeholder="Enter text to display"
                      value={overlay.text}
                      onChange={(e) => updateTextOverlay(index, 'text', e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Time
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="0"
                        value={overlay.startTime}
                        onChange={(e) => updateTextOverlay(index, 'startTime', parseFloat(e.target.value))}
                        className="w-full p-2 border rounded"
                      />
                      <span className="text-xs text-gray-500 mt-1">seconds</span>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Duration
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="2"
                        value={overlay.duration}
                        onChange={(e) => updateTextOverlay(index, 'duration', parseFloat(e.target.value))}
                        className="w-full p-2 border rounded"
                      />
                      <span className="text-xs text-gray-500 mt-1">seconds</span>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        X Position
                      </label>
                      <input
                        type="number"
                        placeholder="100"
                        value={overlay.x}
                        onChange={(e) => updateTextOverlay(index, 'x', parseInt(e.target.value))}
                        className="w-full p-2 border rounded"
                      />
                      <span className="text-xs text-gray-500 mt-1">pixels from left</span>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Y Position
                      </label>
                      <input
                        type="number"
                        placeholder="100"
                        value={overlay.y}
                        onChange={(e) => updateTextOverlay(index, 'y', parseInt(e.target.value))}
                        className="w-full p-2 border rounded"
                      />
                      <span className="text-xs text-gray-500 mt-1">pixels from top</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={addTextOverlay}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <Plus size={20} /> Add Text Overlay
            </button>
          </CardContent>
        </Card>
      )}
{/*
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )} */}

      {error && toast.error(error)}

      <button
        onClick={handleProcess}
        disabled={isProcessing}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-black/90 disabled:bg-black/10"
      >
        {isProcessing ? (
          <>Processing...</>
        ) : (
          <>
            <Save size={20} /> Process Video
          </>
        )}
      </button>
    </div>
  );
};

export default VideoEditor;