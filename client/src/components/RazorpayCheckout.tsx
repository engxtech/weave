import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RazorpayCheckoutProps {
  tierId: number;
  tierName: string;
  price: number;
  billingInterval: 'monthly' | 'yearly';
  onSuccess: () => void;
  onCancel: () => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function RazorpayCheckout({ tierId, tierName, price, billingInterval, onSuccess, onCancel }: RazorpayCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePayment = async () => {
    if (!window.Razorpay) {
      toast({
        title: "Payment Error",
        description: "Razorpay is not loaded. Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Create subscription with billing interval
      const response = await apiRequest("POST", "/api/create-subscription", {
        tierId,
        billingInterval
      });
      const subscriptionData = await response.json();

      const options = {
        key: subscriptionData.key,
        subscription_id: subscriptionData.subscriptionId,
        name: "AI Video Editor",
        description: subscriptionData.description,
        image: "/favicon.ico", // Add your logo here
        handler: async function (response: any) {
          try {
            // Verify payment
            const verificationResponse = await apiRequest("POST", "/api/verify-payment", {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
              tierId
            });
            const verificationResult = await verificationResponse.json();

            toast({
              title: "Payment Successful!",
              description: verificationResult.message,
            });

            onSuccess();
          } catch (error: any) {
            console.error("Payment verification failed:", error);
            toast({
              title: "Payment Verification Failed",
              description: error.message || "Please contact support.",
              variant: "destructive",
            });
          }
        },
        prefill: {
          name: "",
          email: "",
          contact: ""
        },
        notes: {
          tierId: tierId.toString(),
          tierName
        },
        theme: {
          color: "#6366f1"
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
            onCancel();
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error: any) {
      console.error("Payment creation failed:", error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to create payment. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handlePayment}
      disabled={loading}
      className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold py-3 text-lg"
    >
      {loading ? "Processing..." : `Pay ₹${price.toLocaleString()}`}
    </Button>
  );
}