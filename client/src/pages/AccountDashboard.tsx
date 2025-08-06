import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/app-header";
import { 
  User, 
  Crown, 
  Calendar, 
  CreditCard, 
  BarChart3, 
  Settings, 
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Clock,
  Shield,
  LogOut
} from "lucide-react";
import { SubscriptionPricing } from "@/components/SubscriptionPricing";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserSubscription {
  id: number;
  userId: string;
  tierId: number;
  razorpaySubscriptionId: string | null;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  appTokensUsed: number;
  appTokensRemaining: number;
  tier: {
    id: number;
    name: string;
    displayName: string;
    price: string;
    currency: string;
    interval: string;
    features: any;
    appTokens: number;
    maxVideoLength: number;
    maxConcurrentJobs: number;
    aiCreditsPerMonth: number;
  };
}

interface TokenUsage {
  used: number;
  remaining: number;
  total: number;
}

interface UsageHistory {
  id: number;
  feature: string;
  tokensUsed: number;
  description: string;
  createdAt: string;
}

interface AppTokenSummary {
  currentBalance: number;
  totalEarned: number;
  totalSpent: number;
  lastActivity: string | null;
}

interface AppTokenTransaction {
  id: number;
  userId: string;
  tokensUsed: number;
  feature: string;
  description: string;
  createdAt: string;
}

interface ExportQuota {
  used: number;
  total: number;
  remaining: number;
}

export default function AccountDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Type the user properly
  const typedUser = user as {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
    createdAt?: string;
  } | undefined;

  // Fetch user subscription
  const { data: subscription, isLoading: subscriptionLoading } = useQuery<UserSubscription>({
    queryKey: ['/api/user-subscription'],
    enabled: !!user,
  });

  // Fetch token usage
  const { data: tokenUsage, isLoading: usageLoading } = useQuery<TokenUsage>({
    queryKey: ['/api/token-usage'],
    enabled: !!user,
  });

  // Fetch usage history
  const { data: usageHistory } = useQuery<UsageHistory[]>({
    queryKey: ['/api/usage-history'],
    enabled: !!user,
  });

  // Fetch export quota
  const { data: exportQuota, isLoading: exportQuotaLoading } = useQuery<ExportQuota>({
    queryKey: ['/api/export-quota'],
    enabled: !!user,
  });

  // Fetch App Token usage (removed duplicate as tokenUsage is already defined above)
  // Fetch App Token transactions
  const { data: appTokenTransactions } = useQuery<any[]>({
    queryKey: ['/api/app-token-usage'],
    enabled: !!user,
  });

  // Cancel subscription mutation
  const cancelSubscription = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/cancel-subscription');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been cancelled and will not renew.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user-subscription'] });
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getUsagePercentage = () => {
    if (!tokenUsage) return 0;
    return Math.round((tokenUsage.used / tokenUsage.total) * 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500 dark:bg-green-400';
      case 'cancelled': return 'bg-yellow-500 dark:bg-yellow-400';
      case 'expired': return 'bg-red-500 dark:bg-red-400';
      case 'pending': return 'bg-blue-500 dark:bg-blue-400';
      default: return 'bg-gray-500 dark:bg-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <AlertTriangle className="h-4 w-4" />;
      case 'expired': return <AlertTriangle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Please sign in</h2>
          <p className="text-muted-foreground">You need to be logged in to view your account dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <AppHeader />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Account Dashboard
            </h1>
            <p className="text-gray-300">Manage your subscription and monitor usage</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowUpgrade(true)}
              className="flex items-center gap-2 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-300 transition-all duration-300 animate-pulse hover:animate-none hover:shadow-lg hover:shadow-cyan-500/25 backdrop-blur-sm"
            >
              <Crown className="h-4 w-4" />
              Upgrade Plan
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/api/logout'}
              className="flex items-center gap-2 border-red-500/50 text-red-300 hover:bg-red-500/20 hover:border-red-300 transition-all duration-300 backdrop-blur-sm"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Account Information */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={typedUser?.profileImageUrl || undefined} />
                <AvatarFallback>
                  {typedUser?.firstName?.[0]}{typedUser?.lastName?.[0] || typedUser?.email?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">
                  {typedUser?.firstName} {typedUser?.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{typedUser?.email}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Account ID</span>
                <span className="font-mono">{typedUser?.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Member since</span>
                <span>{typedUser?.createdAt ? formatDate(typedUser.createdAt as string) : 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Subscription */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Current Subscription
            </CardTitle>
            <CardDescription>
              Your current plan and billing information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscriptionLoading ? (
              <div className="space-y-4">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
              </div>
            ) : subscription ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {getStatusIcon(subscription.status)}
                      {subscription.tier.displayName} Plan
                    </Badge>
                    <div className={`h-2 w-2 rounded-full ${getStatusColor(subscription.status)}`} />
                    <span className="text-sm text-muted-foreground capitalize">
                      {subscription.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      ₹{parseFloat(subscription.tier.price).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      per {subscription.tier.interval}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 dark:bg-muted/30 rounded-lg border border-border/50">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Billing Cycle</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {subscription.currentPeriodStart ? formatDate(subscription.currentPeriodStart) : 'Not set'} - {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Next Billing</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {subscription.status === 'active' && subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'N/A'}
                    </p>
                  </div>
                </div>

                {subscription.status === 'active' && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowUpgrade(true)}
                      className="flex-1"
                    >
                      Upgrade Plan
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="text-destructive hover:text-destructive">
                          Cancel Subscription
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to cancel your subscription? You'll lose access to premium features at the end of your current billing period ({subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'end of period'}).
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => cancelSubscription.mutate()}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Cancel Subscription
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Crown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Active Subscription</h3>
                <p className="text-muted-foreground mb-4">
                  You're currently on the free tier. Upgrade to unlock premium features.
                </p>
                <Button onClick={() => setShowUpgrade(true)}>
                  Choose a Plan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Statistics */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Usage Statistics
            </CardTitle>
            <CardDescription>
              Monitor your token consumption and quota usage
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usageLoading ? (
              <div className="space-y-4">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-8 bg-muted rounded animate-pulse" />
              </div>
            ) : tokenUsage ? (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Token Usage</span>
                    <span className="text-sm text-muted-foreground">
                      {tokenUsage.used.toLocaleString()} / {tokenUsage.total.toLocaleString()} tokens
                    </span>
                  </div>
                  <Progress value={getUsagePercentage()} className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{getUsagePercentage()}% used</span>
                    <span>{tokenUsage.remaining.toLocaleString()} remaining</span>
                  </div>
                </div>

                {/* App Tokens Section */}
                {subscription && (
                  <div className="space-y-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">App Tokens</span>
                      <span className="text-sm text-blue-600 dark:text-blue-400">
                        {Math.max(0, (subscription.tier.appTokens || 0) - (subscription.appTokensUsed || 0)).toLocaleString()} remaining
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">
                          {(subscription.tier.appTokens || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">Total Tokens</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-red-600 dark:text-red-400">
                          {(subscription.appTokensUsed || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">Used Tokens</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {Math.max(0, (subscription.tier.appTokens || 0) - (subscription.appTokensUsed || 0)).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">Remaining</div>
                      </div>
                    </div>
                    <Progress 
                      value={subscription.tier.appTokens ? ((subscription.appTokensUsed || 0) / subscription.tier.appTokens) * 100 : 0} 
                      className="h-2"
                    />
                    <div className="text-xs text-muted-foreground text-center">
                      Conversion rate: 2000 tokens per $1 spent on AI operations
                    </div>
                  </div>
                )}

                {/* Export Quota Section */}
                {subscription && exportQuota && (
                  <div className="space-y-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">Video Export Quota</span>
                      <span className="text-sm text-green-600 dark:text-green-400">
                        {exportQuota.remaining.toFixed(2)} GB remaining
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">
                          {exportQuota.total.toFixed(1)} GB
                        </div>
                        <div className="text-xs text-muted-foreground">Total Quota</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-red-600 dark:text-red-400">
                          {exportQuota.used.toFixed(2)} GB
                        </div>
                        <div className="text-xs text-muted-foreground">Used</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">
                          {exportQuota.remaining.toFixed(2)} GB
                        </div>
                        <div className="text-xs text-muted-foreground">Remaining</div>
                      </div>
                    </div>
                    <Progress 
                      value={exportQuota.total > 0 ? (exportQuota.used / exportQuota.total) * 100 : 0} 
                      className="h-2"
                    />
                    <div className="text-xs text-muted-foreground text-center">
                      Monthly video export allowance - resets at beginning of each billing cycle
                    </div>
                  </div>
                )}

                {subscription && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-muted/50 dark:bg-muted/30 rounded-lg border border-border/30">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {subscription.tier.maxVideoLength}s
                      </div>
                      <div className="text-xs text-muted-foreground">Max Video Length</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 dark:bg-muted/30 rounded-lg border border-border/30">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {subscription.tier.maxConcurrentJobs}
                      </div>
                      <div className="text-xs text-muted-foreground">Concurrent Jobs</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 dark:bg-muted/30 rounded-lg border border-border/30">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {subscription.tier.aiCreditsPerMonth}
                      </div>
                      <div className="text-xs text-muted-foreground">AI Credits/Month</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 dark:bg-muted/30 rounded-lg border border-border/30">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {subscription.tier.appTokens}
                      </div>
                      <div className="text-xs text-muted-foreground">App Tokens</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No usage data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {usageHistory && usageHistory.length > 0 ? (
              <div className="space-y-3">
                {usageHistory.slice(0, 5).map((usage) => (
                  <div key={usage.id} className="flex items-center justify-between p-2 bg-muted/50 dark:bg-muted/30 rounded border border-border/30">
                    <div>
                      <p className="text-sm font-medium text-foreground">{usage.feature}</p>
                      <p className="text-xs text-muted-foreground">{usage.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{usage.tokensUsed}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(usage.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* App Token History */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              App Token History
            </CardTitle>
            <CardDescription>
              Recent App Token usage and transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {appTokenTransactions && appTokenTransactions.length > 0 ? (
              <div className="space-y-3">
                {appTokenTransactions.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:to-cyan-950/20 rounded border border-blue-200/50 dark:border-blue-800/50">
                    <div>
                      <p className="text-sm font-medium text-foreground">{transaction.feature}</p>
                      <p className="text-xs text-muted-foreground">{transaction.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">
                        -{transaction.tokensUsed} tokens
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No App Token transactions</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Development Utilities */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="mt-6 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <CardHeader>
            <CardTitle className="text-yellow-800 dark:text-yellow-200">
              Development Utilities
            </CardTitle>
            <CardDescription className="text-yellow-600 dark:text-yellow-300">
              These tools are only available in development mode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={async () => {
                try {
                  const response = await apiRequest("POST", "/api/admin/initialize-razorpay-plans");
                  const result = await response.json();
                  toast({
                    title: "Razorpay Plans Initialized",
                    description: `Successfully processed ${result.results?.length || 0} subscription tiers`,
                  });
                  // Refresh subscription tiers data
                  queryClient.invalidateQueries({ queryKey: ['/api/subscription-tiers'] });
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to initialize Razorpay plans",
                    variant: "destructive",
                  });
                }
              }}
              variant="outline"
              className="border-yellow-300 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-600 dark:text-yellow-200 dark:hover:bg-yellow-800/30"
            >
              Initialize Razorpay Plans
            </Button>
          </CardContent>
        </Card>
      )}
      </div>

      {/* Upgrade Modal */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">Choose Your Plan</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowUpgrade(false)}>
                  ×
                </Button>
              </div>
              <SubscriptionPricing 
                onSuccess={() => {
                  setShowUpgrade(false);
                  queryClient.invalidateQueries({ queryKey: ['/api/user-subscription'] });
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}