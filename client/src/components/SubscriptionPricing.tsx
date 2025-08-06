import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Check, Zap, Crown, Building, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RazorpayCheckout } from "./RazorpayCheckout";

interface SubscriptionTier {
  id: number;
  name: string;
  displayName: string;
  price: number;
  currency: string;
  features: any;
  appTokens: number;
  maxVideoLength: number;
  maxConcurrentJobs: number;
  aiCreditsPerMonth: number;
}

interface SubscriptionPricingProps {
  showTitle?: boolean;
  onUpgrade?: (tierId: number) => void;
  onSuccess?: () => void;
}

export function SubscriptionPricing({ showTitle = true, onUpgrade, onSuccess }: SubscriptionPricingProps) {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentPage, setShowPaymentPage] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [globalBillingInterval, setGlobalBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentBillingInterval, setPaymentBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const { toast } = useToast();

  useEffect(() => {
    fetchSubscriptionTiers();
  }, []);

  const fetchSubscriptionTiers = async () => {
    try {
      const response = await apiRequest("GET", "/api/subscription-tiers");
      const data = await response.json();
      console.log("Subscription tiers data:", data);
      // Ensure response is an array
      if (Array.isArray(data)) {
        setTiers(data);
      } else {
        console.error("Response is not an array:", data);
        setTiers([]);
      }
    } catch (error) {
      console.error("Failed to fetch subscription tiers:", error);
      setTiers([]);
      toast({
        title: "Error",
        description: "Failed to load subscription plans",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = (tierId: number) => {
    const tier = tiers.find(t => t.id === tierId);
    if (tier) {
      setSelectedTier(tier);
      setPaymentBillingInterval(globalBillingInterval); // Use global toggle selection
      setShowPaymentPage(true); // Show payment page directly
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentPage(false);
    setSelectedTier(null);
    if (onSuccess) {
      onSuccess();
    }
    toast({
      title: "Subscription Activated",
      description: "Your subscription has been successfully activated!",
    });
  };

  const handlePaymentCancel = () => {
    setShowPaymentPage(false);
    setSelectedTier(null);
  };

  const calculatePrice = (tier: SubscriptionTier, interval: 'monthly' | 'yearly') => {
    if (interval === 'yearly') {
      return tier.price * 10; // 10 months price for yearly (2 months free)
    }
    return tier.price;
  };

  const getTierIcon = (tierName: string) => {
    switch (tierName) {
      case "free":
        return <Zap className="h-6 w-6 text-blue-500" />;
      case "lite":
        return <Check className="h-6 w-6 text-green-500" />;
      case "pro":
        return <Crown className="h-6 w-6 text-purple-500" />;
      case "enterprise":
        return <Building className="h-6 w-6 text-orange-500" />;
      default:
        return <Zap className="h-6 w-6" />;
    }
  };

  const getTierColor = (tierName: string) => {
    switch (tierName) {
      case "free":
        return "border-blue-200 dark:border-blue-800";
      case "lite":
        return "border-green-200 dark:border-green-800";
      case "pro":
        return "border-purple-200 dark:border-purple-800 ring-2 ring-purple-500 dark:ring-purple-400";
      case "enterprise":
        return "border-orange-200 dark:border-orange-800";
      default:
        return "border-gray-200 dark:border-gray-800";
    }
  };

  const getFeatureList = (features: any) => {
    const featureList = [];
    
    if (features.video_editing) featureList.push("Video Editing");
    if (features.ai_chat) featureList.push("AI Chat Assistant");
    if (features.basic_effects) featureList.push("Basic Effects");
    if (features.advanced_effects) featureList.push("Advanced Effects");
    if (features.premium_effects) featureList.push("Premium Effects");
    if (features.api_access) featureList.push("API Access");
    if (features.priority_support) featureList.push("Priority Support");
    if (features.custom_branding) featureList.push("Custom Branding");
    if (features.dedicated_support) featureList.push("Dedicated Support");
    
    if (features.max_exports_per_month === -1) {
      featureList.push("Unlimited Exports");
    } else if (features.max_exports_per_month) {
      featureList.push(`${features.max_exports_per_month} Exports/Month`);
    }
    
    if (!features.watermark) featureList.push("No Watermark");
    
    return featureList;
  };

  if (loading) {
    return (
      <div className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-16">
      <div className="container mx-auto px-4">
        {showTitle && (
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent mb-4">
              Choose Your Plan
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Select the perfect plan for your video editing needs. Upgrade or downgrade at any time.
            </p>
          </div>
        )}

        {/* Universal Billing Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <div className="flex">
              <button
                onClick={() => setGlobalBillingInterval('monthly')}
                className={`px-6 py-2 rounded-md font-medium transition-all duration-200 ${
                  globalBillingInterval === 'monthly'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setGlobalBillingInterval('yearly')}
                className={`px-6 py-2 rounded-md font-medium transition-all duration-200 relative ${
                  globalBillingInterval === 'yearly'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Yearly
                <span className="absolute -top-2 -right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  2 months free
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(tiers || []).map((tier) => (
            <Card
              key={tier.id}
              className={`relative transition-all duration-300 hover:shadow-xl ${getTierColor(tier.name)} ${
                tier.name === "pro" ? "scale-105 lg:scale-110" : ""
              }`}
            >
              {tier.name === "pro" && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-500 text-white">
                  Most Popular
                </Badge>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-2">
                  {getTierIcon(tier.name)}
                </div>
                <CardTitle className="text-2xl font-bold">{tier.displayName}</CardTitle>
                <div className="flex items-baseline justify-center">
                  <span className="text-3xl font-bold">
                    {tier.price === 0 ? "Free" : `₹${calculatePrice(tier, globalBillingInterval)}`}
                  </span>
                  {tier.price > 0 && (
                    <span className="text-gray-500 dark:text-gray-400 ml-1">
                      /{globalBillingInterval === 'yearly' ? 'year' : 'month'}
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>{tier.appTokens.toLocaleString()}</strong> App Tokens
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>{Math.floor(tier.maxVideoLength / 60)}min</strong> Max Video Length
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>{tier.maxConcurrentJobs}</strong> Concurrent Job{tier.maxConcurrentJobs > 1 ? "s" : ""}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>{tier.aiCreditsPerMonth.toLocaleString()}</strong> AI Credits/Month
                  </div>
                </div>

                <hr className="border-gray-200 dark:border-gray-700" />

                <ul className="space-y-2 text-sm">
                  {getFeatureList(tier.features).map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleUpgrade(tier.id)}
                  className={`w-full mt-6 ${
                    tier.name === "free"
                      ? "bg-blue-500 hover:bg-blue-600"
                      : tier.name === "lite"
                      ? "bg-green-500 hover:bg-green-600"
                      : tier.name === "pro"
                      ? "bg-purple-500 hover:bg-purple-600"
                      : "bg-orange-500 hover:bg-orange-600"
                  } text-white`}
                  disabled={tier.name === "free"}
                >
                  {tier.name === "free" ? "Current Plan" : `Upgrade to ${tier.displayName}`}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-600 dark:text-gray-400">
            All plans include 30-day money-back guarantee. No setup fees.
          </p>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentPage && selectedTier && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Complete Your Subscription</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePaymentCancel}
                  className="h-8 w-8 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="text-center mb-6">
                <div className="flex justify-center mb-4">
                  {getTierIcon(selectedTier.name)}
                </div>
                <h4 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">{selectedTier.displayName}</h4>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  ₹{calculatePrice(selectedTier, paymentBillingInterval).toLocaleString()}
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                    /{paymentBillingInterval === 'yearly' ? 'year' : 'month'}
                  </span>
                </div>
                {paymentBillingInterval === 'yearly' && (
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                    Save ₹{(selectedTier.price * 2).toLocaleString()} annually (2 months free)
                  </p>
                )}
              </div>

              {/* Price Summary */}
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-300">Total Amount:</span>
                  <span className="font-bold text-lg text-gray-900 dark:text-white">
                    ₹{calculatePrice(selectedTier, paymentBillingInterval).toLocaleString()}
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                      {paymentBillingInterval === 'monthly' ? '/month' : '/year'}
                    </span>
                  </span>
                </div>
              </div>

              {/* Razorpay Checkout Component */}
              <RazorpayCheckout
                tierId={selectedTier.id}
                tierName={selectedTier.displayName}
                price={calculatePrice(selectedTier, paymentBillingInterval)}
                billingInterval={paymentBillingInterval}
                onSuccess={handlePaymentSuccess}
                onCancel={handlePaymentCancel}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}