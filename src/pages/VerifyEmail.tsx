import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Mail, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    // Simulate email verification process
    const timer = setTimeout(() => {
      setIsVerifying(false);
      setIsVerified(true);
      
      // Redirect to pricing after 3 seconds
      setTimeout(() => {
        navigate("/pricing");
      }, 3000);
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-border/20 bg-[#0a0a0a]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/home" className="flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-white">PropManage</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md bg-[#151515] border-border/30">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              {isVerifying ? (
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              ) : isVerified ? (
                <CheckCircle2 className="h-8 w-8 text-primary" />
              ) : (
                <Mail className="h-8 w-8 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl text-white">
              {isVerifying ? "Verifying your email..." : isVerified ? "Email Verified!" : "Check your email"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {isVerifying 
                ? "Please wait while we verify your email address."
                : isVerified 
                  ? "Your email has been successfully verified. Redirecting you to pricing..."
                  : "We've sent a verification link to your email address."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isVerified && (
              <>
                <div className="w-full bg-[#0a0a0a] rounded-full h-2 overflow-hidden">
                  <div className="bg-primary h-full animate-pulse" style={{ width: '100%' }} />
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => navigate("/pricing")}
                >
                  Continue to Pricing
                </Button>
              </>
            )}
            
            {!isVerifying && !isVerified && (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  Didn't receive the email? Check your spam folder or
                </p>
                <Button variant="outline" className="w-full text-white border-border/30 hover:bg-white/10">
                  Resend verification email
                </Button>
              </>
            )}

            <div className="text-center pt-4">
              <Link 
                to="/login" 
                className="text-sm text-muted-foreground hover:text-white transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-border/20">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          © 2024 PropManage. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default VerifyEmail;
