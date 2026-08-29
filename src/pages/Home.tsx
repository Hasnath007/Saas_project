import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Building2, 
  Users, 
  Wrench, 
  BarChart3, 
  Shield, 
  Clock,
  ArrowRight,
  CheckCircle2,
  Menu,
  X,
  ClipboardList
} from "lucide-react";
import { useState } from "react";

const Home = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const services = [
    {
      icon: Building2,
      title: "Property Management",
      description: "Manage all your properties in one centralized dashboard with real-time updates and insights."
    },
    {
      icon: Users,
      title: "Tenant Management",
      description: "Track tenant information, leases, and communications effortlessly."
    },
    {
      icon: Wrench,
      title: "Maintenance Tracking",
      description: "Handle maintenance requests, assign vendors, and track progress seamlessly."
    },
    {
      icon: BarChart3,
      title: "Financial Analytics",
      description: "Get detailed financial reports, rent collection tracking, and expense management."
    },
    {
      icon: Shield,
      title: "Secure & Reliable",
      description: "Enterprise-grade security to keep your property data safe and protected."
    },
    {
      icon: Clock,
      title: "24/7 Availability",
      description: "Access your property management tools anytime, anywhere, on any device."
    }
  ];

  const features = [
    "Unlimited property listings",
    "Automated rent reminders",
    "Online rent collection",
    "Maintenance request portal",
    "Document storage",
    "Financial reporting"
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <ClipboardList className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">Rentt</span>
              <span className="text-xl font-bold text-muted-foreground">AI</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </Link>
              <a href="#services" className="text-muted-foreground hover:text-foreground transition-colors">
                Services
              </a>
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors">
                About
              </a>
            </div>

            {/* Auth Buttons */}
            <div className="hidden md:flex items-center gap-4">
              <Link to="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link to="/signup">
                <Button>Get Started</Button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6 text-foreground" />
              ) : (
                <Menu className="h-6 w-6 text-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="container mx-auto px-4 py-4 space-y-4">
              <Link 
                to="/pricing" 
                className="block text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <a 
                href="#services" 
                className="block text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Services
              </a>
              <a 
                href="#features" 
                className="block text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>
              <a 
                href="#about" 
                className="block text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </a>
              <div className="pt-4 border-t border-border space-y-2">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full">Sign In</Button>
                </Link>
                <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full">Get Started</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
            Simplify Your Property <br />
            <span className="text-primary">Management</span> Today
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            The all-in-one platform to manage properties, tenants, maintenance, and finances. 
            Save time and grow your portfolio with powerful tools designed for landlords.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button size="lg" className="text-lg px-8 py-6">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                View Pricing
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            No credit card required • 14-day free trial
          </p>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything You Need to Manage Properties
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comprehensive tools designed to streamline every aspect of property management.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <Card key={index} className="group hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <service.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{service.title}</h3>
                  <p className="text-muted-foreground">{service.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Powerful Features for Modern Landlords
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                From rent collection to maintenance tracking, we've got you covered with 
                industry-leading tools that save you time and maximize your returns.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-foreground">{feature}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Link to="/pricing">
                  <Button size="lg">
                    See All Features
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl flex items-center justify-center">
                <div className="grid grid-cols-2 gap-4 p-8">
                  <Card className="p-4">
                    <div className="text-2xl font-bold text-primary">1,200+</div>
                    <div className="text-sm text-muted-foreground">Properties Managed</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-2xl font-bold text-primary">98%</div>
                    <div className="text-sm text-muted-foreground">Satisfaction Rate</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-2xl font-bold text-primary">$2M+</div>
                    <div className="text-sm text-muted-foreground">Rent Collected</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-2xl font-bold text-primary">500+</div>
                    <div className="text-sm text-muted-foreground">Happy Landlords</div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Trusted by Property Managers Worldwide
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-12">
            Rentt AI was built by landlords, for landlords. We understand the challenges 
            of managing properties and have created a solution that makes your life easier. 
            Join thousands of property managers who have transformed their business with our platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button size="lg" className="text-lg px-8 py-6">
                Start Your Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <ClipboardList className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold text-foreground">Rentt</span>
              <span className="text-lg font-semibold text-muted-foreground">AI</span>
            </div>
            <div className="flex gap-8 text-sm text-muted-foreground">
              <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              <a href="#services" className="hover:text-foreground transition-colors">Services</a>
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#about" className="hover:text-foreground transition-colors">About</a>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Rentt AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
