import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "email" | "otp" | "newPassword";

const ForgotPasswordDialog = ({ open, onOpenChange }: ForgotPasswordDialogProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // New password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setStep("email");
      setEmail("");
      setOtpCode("");
      setResendCooldown(0);
      setNewPassword("");
      setConfirmPassword("");
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
  }, [open]);

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

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if email exists
      const { data: authCheck } = await supabase.functions.invoke("check-email-exists", {
        body: { email },
      });

      if (!authCheck?.exists) {
        toast({
          title: "Email Not Found",
          description: "No account found with this email address.",
          variant: "destructive",
        });
        return;
      }

      // Send OTP
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { email, type: "password_reset" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setStep("otp");
      startCooldown();
      toast({
        title: "Verification code sent!",
        description: `We've sent a 6-digit code to ${email}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send verification code.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { email, code: otpCode, type: "password_reset" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setStep("newPassword");
      toast({
        title: "Email verified!",
        description: "You can now set a new password.",
      });
    } catch (error: any) {
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
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { email, type: "password_reset" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      startCooldown();
      setOtpCode("");
      toast({
        title: "Code resent!",
        description: "A new verification code has been sent.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to resend code.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 12) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 12 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^a-zA-Z0-9]/.test(newPassword)) {
      toast({
        title: "Weak Password",
        description: "Password must contain letters, numbers, and special characters.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure both passwords match.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: { email, newPassword },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Password Reset Successful",
          description: "Your password has been updated. You can now log in.",
        });
        onOpenChange(false);
      } else {
        throw new Error(data?.error || "Failed to reset password");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "email" && "Forgot Password"}
            {step === "otp" && "Verify Your Email"}
            {step === "newPassword" && "Set New Password"}
          </DialogTitle>
          <DialogDescription>
            {step === "email" && "Enter your email address to reset your password."}
            {step === "otp" && `Enter the 6-digit code sent to ${email}`}
            {step === "newPassword" && "Create a new password for your account."}
          </DialogDescription>
        </DialogHeader>

        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email Address</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending code..." : "Send Verification Code"}
            </Button>
          </form>
        )}

        {step === "otp" && (
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
              {loading ? "Verifying..." : "Verify Code"}
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
                onClick={() => { setStep("email"); setOtpCode(""); }}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
            </div>
          </div>
        )}

        {step === "newPassword" && (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={12}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Must be 12+ characters with letters, numbers, and special characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={12}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ForgotPasswordDialog;
