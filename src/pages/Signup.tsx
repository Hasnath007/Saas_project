import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character");

const signupSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50, "First name is too long"),
  lastName: z.string().trim().min(1, "Last name is required").max(50, "Last name is too long"),
  email: z.string().trim().email("Invalid email address"),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

const Signup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otpCode, setOtpCode] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupValues, setSignupValues] = useState<SignupFormValues | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // API config
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  console.log("Supabase URL:", supabaseUrl);
  console.log("API Key:", apiKey?.substring(0, 10) + "...");

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const startCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const onSubmit = async (values: SignupFormValues) => {
    setLoading(true);
    try {
      // Send OTP to email first
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { email: values.email, type: "signup" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSignupEmail(values.email);
      setSignupValues(values);
      setStep("otp");
      startCooldown();
      toast({
        title: "Verification code sent!",
        description: `We've sent a 6-digit code to ${values.email}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send verification code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6 || !signupValues) return;
    setLoading(true);

    try {
      // Verify OTP
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
        "verify-otp",
        {
          body: { email: signupEmail, code: otpCode, type: "signup" },
        }
      );

      if (verifyError) throw verifyError;
      if (verifyData?.error) throw new Error(verifyData.error);

      console.log("✅ OTP verified successfully");

      // OTP verified — now create the account
      console.log("📝 Attempting to create account with:", signupValues.email);
      const { error: signupError } = await supabase.auth.signUp({
        email: signupValues.email,
        password: signupValues.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: signupValues.firstName,
            last_name: signupValues.lastName,
          },
        },
      });

      console.log("📝 signUp response error:", signupError);
      if (signupError) {
        console.error("❌ SignUp error:", signupError.message);
        throw signupError;
      }
      
      console.log("✅ Account created successfully");

      // Send welcome email (fire-and-forget)
      supabase.functions.invoke("send-auth-email", {
        body: {
          to: signupValues.email,
          type: "welcome",
          firstName: signupValues.firstName,
        },
      }).catch(console.error);

      toast({
        title: "Account created!",
        description: "Email verified successfully. Please select a plan to continue.",
      });
      navigate("/pricing");
    } catch (error: any) {
      console.error("❌ Signup error caught:", error);
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid or expired code. Please try again.",
        variant: "destructive",
      });
      setOtpCode("");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      // Resend OTP
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { email: signupEmail, type: "signup" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      startCooldown();
      setOtpCode("");
      toast({
        title: "Code resent!",
        description: "A new verification code has been sent to your email.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to resend code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/home" className="flex items-center justify-center gap-2 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <ClipboardList className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Rentt</span>
            <span className="text-xl font-bold text-muted-foreground">AI</span>
          </Link>
          <CardTitle>{step === "form" ? "Create Account" : "Verify Your Email"}</CardTitle>
          <CardDescription>
            {step === "form"
              ? "Enter your details to create a new account"
              : `Enter the 6-digit code sent to ${signupEmail}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "form" ? (
            <>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="your@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Create a strong password"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground mt-1">
                          Must be 12+ characters with letters, numbers, and special characters
                        </p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Confirm your password"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Sending code..." : "Create Account"}
                  </Button>
                </form>
              </Form>

              <div className="mt-4 text-center text-sm">
                Already have an account?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Login
                </Link>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={(value) => setOtpCode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                className="w-full"
                disabled={loading || otpCode.length !== 6}
                onClick={handleVerifyOtp}
              >
                {loading ? "Verifying..." : "Verify & Create Account"}
              </Button>

              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Didn't receive the code?{" "}
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || loading}
                    className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                </p>
                <button
                  type="button"
                  onClick={() => { setStep("form"); setOtpCode(""); }}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to signup
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
