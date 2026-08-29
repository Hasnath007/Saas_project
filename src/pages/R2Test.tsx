import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Loader2 } from "lucide-react";

const R2Test = () => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{
    fileName: string;
    url: string;
    path: string;
  } | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Sample image data URL (a small test image)
  const generateTestImage = (): Blob => {
    // Create a canvas with a simple test pattern
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    
    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 400, 300);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 300);
    
    // Add text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('R2 Test Image', 200, 150);
    
    ctx.font = '16px Arial';
    ctx.fillText(new Date().toLocaleString(), 200, 180);
    
    // Convert canvas to blob
    return new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob!);
      }, 'image/png');
    }) as any;
  };

  const handleUpload = async () => {
    setUploading(true);
    try {
      // Generate test image
      const imageBlob = await generateTestImage();
      const file = new File([imageBlob], `test-image-${Date.now()}.png`, { type: 'image/png' });

      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', 'test-uploads');

      // Upload to R2
      const { data, error } = await supabase.functions.invoke('r2-upload', {
        body: formData,
      });

      if (error) throw error;

      setUploadedFile(data);
      toast({
        title: "Success!",
        description: `Image uploaded to R2: ${data.fileName}`,
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!uploadedFile) return;
    
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke('r2-download', {
        body: { filePath: uploadedFile.path },
      });

      if (error) throw error;

      // Create a download link
      const blob = new Blob([data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = uploadedFile.fileName.split('/').pop() || 'download.png';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success!",
        description: "Image downloaded from R2",
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Cloudflare R2 Integration Test</h1>
          <p className="text-muted-foreground mt-2">
            Test your R2 bucket connection by uploading and downloading a sample image
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload Test</CardTitle>
            <CardDescription>
              Generate and upload a test image to your R2 bucket
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleUpload} 
              disabled={uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Generate & Upload Test Image
                </>
              )}
            </Button>

            {uploadedFile && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium">Upload Successful!</p>
                <div className="text-xs space-y-1 text-muted-foreground">
                  <p><strong>File:</strong> {uploadedFile.fileName}</p>
                  <p><strong>Path:</strong> {uploadedFile.path}</p>
                  <p className="break-all"><strong>URL:</strong> {uploadedFile.url}</p>
                </div>
                <Button 
                  onClick={handleDownload} 
                  disabled={downloading}
                  variant="secondary"
                  className="w-full mt-2"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download from R2
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integration Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bucket:</span>
              <span className="font-mono">rentt-ai-bucket</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Endpoint:</span>
              <span className="font-mono text-xs">8cbf5db8bbc06a9fa335441e4799cfbe.r2.cloudflarestorage.com</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Edge Functions:</span>
              <span className="font-mono">r2-upload, r2-download</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default R2Test;
