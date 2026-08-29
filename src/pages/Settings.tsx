import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Shield, Palette, Zap, Settings as SettingsIcon, Upload } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

const profileSchema = z.object({
  first_name: z.string().trim().max(50).optional().or(z.literal("")),
  last_name: z.string().trim().max(50).optional().or(z.literal("")),
  phone: z.string().max(20),
  timezone: z.string().min(1, "Timezone is required"),
});


const Settings = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [theme, setTheme] = useState<string>("light");
  const [avatarBlobUrl, setAvatarBlobUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    timezone: "Eastern Standard Time",
  });


  const [notifications, setNotifications] = useState({
    email_notifications: true,
    sms_notifications: false,
    push_notifications: true,
    marketing_communications: false,
  });

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email || "");
      }
    });
  }, []);

  // Fetch user profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        // If profile doesn't exist, create it
        if (error.code === "PGRST116") {
          const { data: newProfile, error: insertError } = await supabase
            .from("profiles")
            .insert({
              user_id: userId,
              first_name: "",
              last_name: "",
            })
            .select()
            .single();

          if (insertError) throw insertError;
          return newProfile;
        }
        throw error;
      }
      
      return data;
    },
    enabled: !!userId,
  });

  // Update form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        phone: profile.phone || "",
        timezone: profile.timezone || "Eastern Standard Time",
      });

      setNotifications({
        email_notifications: profile.email_notifications ?? true,
        sms_notifications: profile.sms_notifications ?? false,
        push_notifications: profile.push_notifications ?? true,
        marketing_communications: profile.marketing_communications ?? false,
      });
      setTheme(profile.theme || "light");
      
      // Apply theme to document
      if (profile.theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [profile]);

  // Helper to extract path from R2 URL or return as-is if already a path
  const extractR2Path = (urlOrPath: string): string => {
    // If it's a full URL, extract just the path after the bucket name
    if (urlOrPath.startsWith('https://')) {
      const bucketName = 'rentt-ai-bucket';
      const bucketIndex = urlOrPath.indexOf(bucketName);
      if (bucketIndex !== -1) {
        return urlOrPath.substring(bucketIndex + bucketName.length + 1);
      }
    }
    return urlOrPath;
  };

  // Fetch avatar from Supabase Storage when profile loads
  useEffect(() => {
    const fetchAvatar = async () => {
      if (profile?.avatar_url) {
        try {
          // Get public URL from Supabase Storage
          const { data } = supabase.storage
            .from("profile-pictures")
            .getPublicUrl(profile.avatar_url);
          
          if (data?.publicUrl) {
            setAvatarBlobUrl(data.publicUrl);
          }
        } catch (err) {
          console.error("Error fetching avatar:", err);
        }
      }
    };
    
    fetchAvatar();
  }, [profile?.avatar_url]);

  // Save profile mutation
  const saveProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!userId) throw new Error("User not authenticated");

      // Validate data
      const validated = profileSchema.parse(data);

      const { error } = await supabase
        .from("profiles")
        .update(validated)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success("Profile updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  // Upload profile picture mutation using Supabase Storage
  const uploadPictureMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!userId) throw new Error("User not authenticated");

      // Validate file size (100KB = 102400 bytes)
      if (file.size > 102400) {
        throw new Error("File size must be less than 100KB");
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        throw new Error("File must be an image");
      }

      const fileExt = file.name.split(".").pop();
      const filePath = `${userId}/avatar.${fileExt}`;

      // Delete old picture if exists
      await supabase.storage
        .from("profile-pictures")
        .remove([filePath]);

      // Upload new picture to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("profile-pictures")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(filePath);

      // Update profile with avatar path
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: filePath })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: (publicUrl) => {
      setAvatarBlobUrl(publicUrl);
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success("Profile picture updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to upload picture");
    },
  });

  // Save theme mutation
  const saveThemeMutation = useMutation({
    mutationFn: async (selectedTheme: string) => {
      if (!userId) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({ theme: selectedTheme })
        .eq("user_id", userId);

      if (error) throw error;

      // Apply theme
      if (selectedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success("Theme updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update theme");
    },
  });

  // Save notifications mutation
  const saveNotificationsMutation = useMutation({
    mutationFn: async (data: typeof notifications) => {
      if (!userId) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update(data)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success("Notification preferences updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update preferences");
    },
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNotificationChange = (field: keyof typeof notifications, value: boolean) => {
    const updatedNotifications = { ...notifications, [field]: value };
    setNotifications(updatedNotifications);
    saveNotificationsMutation.mutate(updatedNotifications);
  };

  const handleSaveProfile = () => {
    saveProfileMutation.mutate(formData);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadPictureMutation.mutate(file);
    }
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
  };

  const handleSaveTheme = () => {
    saveThemeMutation.mutate(theme);
  };

  const getInitials = () => {
    const first = formData.first_name.charAt(0).toUpperCase();
    const last = formData.last_name.charAt(0).toUpperCase();
    return first && last ? `${first}${last}` : "JD";
  };

  const getAvatarUrl = () => {
    return avatarBlobUrl;
  };
  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your account preferences and platform configuration</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="display" className="gap-2">
              <Palette className="h-4 w-4" />
              Display
            </TabsTrigger>
            <TabsTrigger value="apps" className="gap-2">
              <Zap className="h-4 w-4" />
              Apps
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-2">
              <SettingsIcon className="h-4 w-4" />
              Advanced
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  {getAvatarUrl() ? (
                    <img 
                      src={getAvatarUrl()!} 
                      alt="Profile" 
                      className="h-20 w-20 rounded-full object-cover border-2 border-border"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-medium">
                      {getInitials()}
                    </div>
                  )}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadPictureMutation.isPending}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {uploadPictureMutation.isPending ? "Uploading..." : "Change Photo"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Max size: 100KB • JPG, PNG, or WebP
                    </p>
                  </div>
                </div>

                {isLoading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading profile...</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input 
                          id="firstName" 
                          value={formData.first_name}
                          onChange={(e) => handleInputChange("first_name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input 
                          id="lastName" 
                          value={formData.last_name}
                          onChange={(e) => handleInputChange("last_name", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input 
                          id="email" 
                          type="email" 
                          value={userEmail}
                          disabled
                          className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input 
                          id="phone" 
                          type="tel" 
                          value={formData.phone}
                          onChange={(e) => handleInputChange("phone", e.target.value)}
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select 
                        value={formData.timezone}
                        onValueChange={(value) => handleInputChange("timezone", value)}
                      >
                        <SelectTrigger id="timezone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="Eastern Standard Time">Eastern Standard Time</SelectItem>
                          <SelectItem value="Central Standard Time">Central Standard Time</SelectItem>
                          <SelectItem value="Mountain Standard Time">Mountain Standard Time</SelectItem>
                          <SelectItem value="Pacific Standard Time">Pacific Standard Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>


                    <Button 
                      className="gap-2"
                      onClick={handleSaveProfile}
                      disabled={saveProfileMutation.isPending}
                    >
                      <User className="h-4 w-4" />
                      {saveProfileMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch 
                    checked={notifications.email_notifications}
                    onCheckedChange={(checked) => handleNotificationChange("email_notifications", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">SMS Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive urgent alerts via SMS</p>
                  </div>
                  <Switch 
                    checked={notifications.sms_notifications}
                    onCheckedChange={(checked) => handleNotificationChange("sms_notifications", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Push Notifications</p>
                    <p className="text-sm text-muted-foreground">Browser and mobile push notifications</p>
                  </div>
                  <Switch 
                    checked={notifications.push_notifications}
                    onCheckedChange={(checked) => handleNotificationChange("push_notifications", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Marketing Communications</p>
                    <p className="text-sm text-muted-foreground">Product updates and tips</p>
                  </div>
                  <Switch 
                    checked={notifications.marketing_communications}
                    onCheckedChange={(checked) => handleNotificationChange("marketing_communications", checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Settings
                </CardTitle>
                <CardDescription>Manage your account security and authentication</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input id="currentPassword" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input id="newPassword" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input id="confirmPassword" type="password" />
                </div>
                <Button>Update Password</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>Add an extra layer of security to your account</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable 2FA</p>
                    <p className="text-sm text-muted-foreground">Require verification code when signing in</p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="display" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Display Preferences
                </CardTitle>
                <CardDescription>Customize how the app looks and feels</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select 
                    value={theme}
                    onValueChange={handleThemeChange}
                  >
                    <SelectTrigger id="theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose between light and dark theme
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleSaveTheme}
                  disabled={saveThemeMutation.isPending}
                  className="gap-2"
                >
                  <Palette className="h-4 w-4" />
                  {saveThemeMutation.isPending ? "Saving..." : "Save Display Settings"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="apps" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Connected Apps
                </CardTitle>
                <CardDescription>Manage integrations and connected services</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">No apps connected yet</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  Advanced Settings
                </CardTitle>
                <CardDescription>Configure advanced features and options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">API Access</p>
                    <p className="text-sm text-muted-foreground">Enable API access for integrations</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Developer Mode</p>
                    <p className="text-sm text-muted-foreground">Show advanced debugging options</p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
