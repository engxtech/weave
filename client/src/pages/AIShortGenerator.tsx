import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Play, Download, Loader2, Bot, Mic, Image, Clock } from 'lucide-react';

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  labels?: { [key: string]: string };
  preview_url?: string;
  available_for_tiers?: string[];
  settings?: {
    stability: number;
    similarity_boost: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

interface AIShortResult {
  id: string;
  videoPath: string;
  audioPath: string;
  imagesPaths: string[];
  script: string;
  metadata: {
    duration: number;
    voiceName: string;
    style: string;
    createdAt: string;
  };
}

const styles = [
  { value: 'viral', label: 'Viral', description: 'Hook viewers with psychological triggers and engaging content' },
  { value: 'educational', label: 'Educational', description: 'Clear, informative content with memorable takeaways' },
  { value: 'story', label: 'Story', description: 'Narrative-driven content with emotional connection' },
  { value: 'entertainment', label: 'Entertainment', description: 'High-energy, humorous, and shareable content' }
];

// Sample prompts from Revideo examples
const samplePrompts = {
  viral: "Did you know that octopuses have three hearts? This will blow your mind - here's the incredible science behind how these creatures survive!",
  educational: "Learn the 80/20 rule that successful entrepreneurs use to maximize productivity and transform their business in just 60 seconds",
  story: "A young programmer discovered a simple coding trick that landed him a $200k job at Google. Here's exactly what he did...",
  entertainment: "Testing the world's most expensive vs cheapest headphones - the results will shock you! Which one sounds better?"
};

export function AIShortGenerator() {
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [detailedVoiceData, setDetailedVoiceData] = useState<any>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [script, setScript] = useState('');
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState([30]);
  const [style, setStyle] = useState('viral');
  const [backgroundMusic, setBackgroundMusic] = useState(0.5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AIShortResult | null>(null);
  const [useScript, setUseScript] = useState(false);
  const [playingSample, setPlayingSample] = useState<string | null>(null);
  const [showDetailedData, setShowDetailedData] = useState(false);
  const { toast } = useToast();

  // Load available voices on component mount
  useEffect(() => {
    loadVoices();
    loadDetailedVoiceData();
  }, []);

  // Debug log to see voice data structure
  useEffect(() => {
    if (voices.length > 0 && detailedVoiceData) {
      console.log('Sample voice data:', voices[0]);
      console.log('Sample detailed voice data:', detailedVoiceData.voices?.[0]);
      console.log('Available languages:', getAvailableLanguages());
      console.log('Available genders:', getAvailableGenders());
      console.log('Available countries:', getAllCountries());
    }
  }, [voices, detailedVoiceData]);

  const loadVoices = async () => {
    try {
      const response = await fetch('/api/elevenlabs/voices');
      if (!response.ok) throw new Error('Failed to load voices');
      
      const data = await response.json();
      setVoices(data.voices);
      
      // Set default voice if available
      if (data.voices.length > 0) {
        setSelectedVoice(data.voices[0].name);
      }
    } catch (error) {
      console.error('Failed to load voices:', error);
      toast({
        title: "Error",
        description: "Failed to load available voices. Please check your ElevenLabs API key.",
        variant: "destructive"
      });
    }
  };

  const loadDetailedVoiceData = async () => {
    try {
      const response = await fetch('/api/elevenlabs/voices/detailed');
      if (!response.ok) throw new Error('Failed to load detailed voice data');
      
      const data = await response.json();
      setDetailedVoiceData(data);
      console.log('Detailed voice data:', data);
    } catch (error) {
      console.error('Failed to load detailed voice data:', error);
    }
  };

  // Country mapping with codes and display names
  const countryMapping = {
    'all': { name: 'All Countries', code: 'ALL' },
    'american': { name: 'United States', code: 'US' },
    'british': { name: 'United Kingdom', code: 'GB' },
    'australian': { name: 'Australia', code: 'AU' },
    'indian': { name: 'India', code: 'IN' },
    'irish': { name: 'Ireland', code: 'IE' },
    'canadian': { name: 'Canada', code: 'CA' },
    'south_african': { name: 'South Africa', code: 'ZA' },
    'new_zealand': { name: 'New Zealand', code: 'NZ' },
    'scottish': { name: 'Scotland', code: 'SC' },
    'welsh': { name: 'Wales', code: 'WL' },
    'nigerian': { name: 'Nigeria', code: 'NG' },
    'jamaican': { name: 'Jamaica', code: 'JM' },
    'german': { name: 'Germany', code: 'DE' },
    'french': { name: 'France', code: 'FR' },
    'spanish': { name: 'Spain', code: 'ES' },
    'italian': { name: 'Italy', code: 'IT' },
    'portuguese': { name: 'Portugal', code: 'PT' },
    'brazilian': { name: 'Brazil', code: 'BR' },
    'mexican': { name: 'Mexico', code: 'MX' },
    'argentinian': { name: 'Argentina', code: 'AR' },
    'chinese': { name: 'China', code: 'CN' },
    'japanese': { name: 'Japan', code: 'JP' },
    'korean': { name: 'South Korea', code: 'KR' },
    'russian': { name: 'Russia', code: 'RU' },
    'dutch': { name: 'Netherlands', code: 'NL' },
    'swedish': { name: 'Sweden', code: 'SE' },
    'norwegian': { name: 'Norway', code: 'NO' },
    'danish': { name: 'Denmark', code: 'DK' },
    'finnish': { name: 'Finland', code: 'FI' }
  };

  // Get all countries (not just ones with available voices)
  const getAllCountries = () => {
    return Object.keys(countryMapping);
  };

  // Get available languages from voice data using detailed data
  const getAvailableLanguages = () => {
    const languages = new Set<string>();
    
    // Check detailed voice data first as it has more complete information
    if (detailedVoiceData?.voices) {
      detailedVoiceData.voices.forEach((voice: any) => {
        if (voice.labels?.language) {
          languages.add(voice.labels.language);
        }
        if (voice.fine_tuning?.language) {
          languages.add(voice.fine_tuning.language);
        }
      });
    }
    
    // Fallback to basic voice data
    voices.forEach(voice => {
      if (voice.labels?.language) {
        languages.add(voice.labels.language);
      }
    });
    
    console.log('Languages found:', Array.from(languages));
    return Array.from(languages).sort();
  };

  // Get available genders from voice data using detailed data
  const getAvailableGenders = () => {
    const genders = new Set<string>();
    
    // Check detailed voice data first as it has more complete information
    if (detailedVoiceData?.voices) {
      detailedVoiceData.voices.forEach((voice: any) => {
        if (voice.labels?.gender) {
          genders.add(voice.labels.gender);
        }
      });
    }
    
    // Fallback to basic voice data
    voices.forEach(voice => {
      if (voice.labels?.gender) {
        genders.add(voice.labels.gender);
      }
    });
    
    console.log('Genders found:', Array.from(genders));
    return Array.from(genders).sort();
  };

  // Get count of available voices for display
  const getAvailableVoicesCount = () => {
    const availableAccents = new Set<string>();
    voices.forEach(voice => {
      if (voice.labels?.accent) {
        availableAccents.add(voice.labels.accent);
      }
    });
    return availableAccents.size;
  };

  // Filter voices by selected filters
  const getFilteredVoices = () => {
    return voices.filter(voice => {
      // Find matching detailed voice data for enhanced filtering
      const detailedVoice = detailedVoiceData?.voices?.find((dv: any) => dv.voice_id === voice.voice_id);
      
      // Country/Accent filter
      if (selectedCountry !== 'all') {
        const voiceAccent = voice.labels?.accent || detailedVoice?.labels?.accent;
        if (voiceAccent !== selectedCountry) {
          return false;
        }
      }
      
      // Language filter - check multiple sources
      if (selectedLanguage !== 'all') {
        const voiceLanguage = voice.labels?.language || 
                            detailedVoice?.labels?.language || 
                            detailedVoice?.fine_tuning?.language;
        if (voiceLanguage !== selectedLanguage) {
          return false;
        }
      }
      
      // Gender filter - check multiple sources
      if (selectedGender !== 'all') {
        const voiceGender = voice.labels?.gender || detailedVoice?.labels?.gender;
        if (!voiceGender) {
          // If no gender info, assume it could match for filtering purposes
          return true;
        }
        if (voiceGender !== selectedGender) {
          return false;
        }
      }
      
      return true;
    });
  };

  const playVoiceSample = async (voiceId: string, voiceName: string) => {
    if (playingSample === voiceId) {
      setPlayingSample(null);
      return;
    }

    try {
      setPlayingSample(voiceId);
      
      // Get country code for personalized greeting
      const voice = voices.find(v => v.voice_id === voiceId);
      const accent = voice?.labels?.accent || 'american';
      const countryCode = countryMapping[accent as keyof typeof countryMapping]?.code || 'US';
      const countryName = countryMapping[accent as keyof typeof countryMapping]?.name || 'Unknown';
      
      // Create localized greeting based on country
      let greetingText = `Hi! I'm ${voiceName} from ${countryName}. This is how I sound when I speak. I hope you like my voice!`;
      
      // Add country-specific phrases
      if (accent === 'british') {
        greetingText = `Hello there! I'm ${voiceName} from Britain. Lovely to meet you! This is how I sound when I speak.`;
      } else if (accent === 'australian') {
        greetingText = `G'day! I'm ${voiceName} from Australia. How ya going? This is how I sound when I speak, mate!`;
      } else if (accent === 'irish') {
        greetingText = `Top of the morning! I'm ${voiceName} from Ireland. How are you keeping? This is how I sound when I speak.`;
      } else if (accent === 'indian') {
        greetingText = `Namaste! I'm ${voiceName} from India. How are you doing? This is how I sound when I speak.`;
      } else if (accent === 'canadian') {
        greetingText = `Hello! I'm ${voiceName} from Canada, eh? How's it going? This is how I sound when I speak.`;
      }

      const response = await fetch('/api/elevenlabs/voice-sample', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          voiceId, 
          text: greetingText,
          countryCode: countryCode
        }),
      });

      if (!response.ok) throw new Error('Failed to generate voice sample');
      
      const data = await response.json();
      
      if (data.success && data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        audio.play();
        
        audio.onended = () => {
          setPlayingSample(null);
        };
        
        audio.onerror = () => {
          setPlayingSample(null);
          toast({
            title: "Error",
            description: "Failed to play voice sample",
            variant: "destructive",
          });
        };
      }
    } catch (error) {
      console.error('Failed to play voice sample:', error);
      setPlayingSample(null);
      toast({
        title: "Error",
        description: "Failed to generate voice sample",
        variant: "destructive",
      });
    }
  };

  const handleStyleChange = (newStyle: string) => {
    setStyle(newStyle);
    // Update prompt with sample for the selected style
    if (!useScript) {
      setPrompt(samplePrompts[newStyle as keyof typeof samplePrompts] || '');
    }
  };

  const generateAIShort = async () => {
    if (!selectedVoice) {
      toast({
        title: "Error",
        description: "Please select a voice for the AI short",
        variant: "destructive"
      });
      return;
    }

    if (!script && !prompt) {
      toast({
        title: "Error", 
        description: "Please provide either a script or a prompt",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setResult(null);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + Math.random() * 15, 90));
      }, 1000);

      const response = await fetch('/api/ai-shorts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: useScript ? script : undefined,
          prompt: !useScript ? prompt : undefined,
          duration: duration[0],
          voiceName: selectedVoice,
          backgroundMusic: backgroundMusic.toString(),
          style
        })
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate AI short');
      }

      const data = await response.json();
      setResult(data.result);
      setProgress(100);

      toast({
        title: "Success!",
        description: "AI Short generated successfully. You can now preview and save it.",
      });

    } catch (error) {
      console.error('AI Short generation failed:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate AI short",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const previewAudio = () => {
    if (result?.audioPath) {
      const audio = new Audio(`/api/uploads/${result.audioPath.split('/').pop()}`);
      audio.play().catch(err => {
        console.error('Failed to play audio:', err);
        toast({
          title: "Playback Error",
          description: "Failed to play the generated audio",
          variant: "destructive"
        });
      });
    }
  };

  const downloadResult = () => {
    if (result?.audioPath) {
      const link = document.createElement('a');
      link.href = `/api/uploads/${result.audioPath.split('/').pop()}`;
      link.download = `ai_short_${result.id}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Bot className="h-8 w-8 text-purple-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              AI Shorts Generator
            </h1>
          </div>
          <p className="text-slate-300 text-lg max-w-3xl mx-auto">
            Create engaging short-form videos with AI-generated scripts, professional voiceovers, and stunning visuals. 
            Perfect for TikTok, Instagram Reels, and YouTube Shorts.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Configuration */}
          <div className="space-y-6">
            {/* Content Type Selection */}
            <Card className="bg-slate-900/50 border-purple-500/20 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-purple-300 flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Content Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant={!useScript ? "default" : "outline"}
                    onClick={() => setUseScript(false)}
                    className="flex-1"
                  >
                    Generate from Prompt
                  </Button>
                  <Button
                    variant={useScript ? "default" : "outline"}
                    onClick={() => setUseScript(true)}
                    className="flex-1"
                  >
                    Use Custom Script
                  </Button>
                </div>

                {!useScript ? (
                  <div className="space-y-2">
                    <Label htmlFor="prompt">Content Prompt</Label>
                    <Textarea
                      id="prompt"
                      placeholder="Describe what you want your AI short to be about..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="bg-slate-800/50 border-slate-600"
                      rows={4}
                    />
                    <p className="text-sm text-slate-400">
                      Example: "Explain quantum physics in simple terms" or "Show 5 life hacks for productivity"
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="script">Video Script</Label>
                    <Textarea
                      id="script"
                      placeholder="Enter your complete video script here..."
                      value={script}
                      onChange={(e) => setScript(e.target.value)}
                      className="bg-slate-800/50 border-slate-600"
                      rows={6}
                    />
                    <p className="text-sm text-slate-400">
                      Write the exact words you want the AI to speak in your video
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Style Selection */}
            <Card className="bg-slate-900/50 border-purple-500/20 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-purple-300">Content Style</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {styles.map((s) => (
                    <div
                      key={s.value}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        style === s.value
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-slate-600 bg-slate-800/30 hover:border-purple-400'
                      }`}
                      onClick={() => handleStyleChange(s.value)}
                    >
                      <div className="font-medium text-white">{s.label}</div>
                      <div className="text-sm text-slate-400 mt-1">{s.description}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Voice Selection */}
            <Card className="bg-slate-900/50 border-purple-500/20 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-purple-300 flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Voice Selection
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDetailedData(!showDetailedData)}
                  className="text-xs"
                >
                  {showDetailedData ? 'Hide' : 'Show'} Raw Data
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Language Filter */}
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-600">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400">ALL</span>
                            <span>All Languages</span>
                          </div>
                        </SelectItem>
                        {getAvailableLanguages().length === 0 ? (
                          <SelectItem value="en">
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-slate-400">EN</span>
                                <span>English</span>
                              </div>
                              <span className="text-xs text-slate-500 ml-2">
                                ({voices.length})
                              </span>
                            </div>
                          </SelectItem>
                        ) : (
                          getAvailableLanguages().map((language) => {
                            const voiceCount = voices.filter(voice => {
                              const detailedVoice = detailedVoiceData?.voices?.find((dv: any) => dv.voice_id === voice.voice_id);
                              return voice.labels?.language === language || 
                                     detailedVoice?.labels?.language === language ||
                                     detailedVoice?.fine_tuning?.language === language;
                            }).length;
                            return (
                              <SelectItem key={language} value={language}>
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-slate-400">
                                      {language.toUpperCase()}
                                    </span>
                                    <span>
                                      {language === 'en' ? 'English' : 
                                       language === 'es' ? 'Spanish' :
                                       language === 'fr' ? 'French' :
                                       language === 'de' ? 'German' :
                                       language === 'it' ? 'Italian' :
                                       language === 'pt' ? 'Portuguese' :
                                       language === 'pl' ? 'Polish' :
                                       language === 'tr' ? 'Turkish' :
                                       language === 'ru' ? 'Russian' :
                                       language === 'nl' ? 'Dutch' :
                                       language === 'cs' ? 'Czech' :
                                       language === 'ar' ? 'Arabic' :
                                       language === 'zh' ? 'Chinese' :
                                       language === 'ja' ? 'Japanese' :
                                       language === 'hi' ? 'Hindi' :
                                       language === 'ko' ? 'Korean' :
                                       language.charAt(0).toUpperCase() + language.slice(1)}
                                    </span>
                                  </div>
                                  <span className="text-xs text-slate-500 ml-2">
                                    ({voiceCount})
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Gender Filter */}
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={selectedGender} onValueChange={setSelectedGender}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-600">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400">ALL</span>
                            <span>All Genders</span>
                          </div>
                        </SelectItem>
                        {getAvailableGenders().length === 0 ? (
                          <>
                            <SelectItem value="male">
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-slate-400">♂</span>
                                  <span>Male</span>
                                </div>
                                <span className="text-xs text-slate-500 ml-2">
                                  ({Math.floor(voices.length / 2)})
                                </span>
                              </div>
                            </SelectItem>
                            <SelectItem value="female">
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-slate-400">♀</span>
                                  <span>Female</span>
                                </div>
                                <span className="text-xs text-slate-500 ml-2">
                                  ({Math.ceil(voices.length / 2)})
                                </span>
                              </div>
                            </SelectItem>
                          </>
                        ) : (
                          getAvailableGenders().map((gender) => {
                            const voiceCount = voices.filter(voice => {
                              const detailedVoice = detailedVoiceData?.voices?.find((dv: any) => dv.voice_id === voice.voice_id);
                              return voice.labels?.gender === gender || detailedVoice?.labels?.gender === gender;
                            }).length;
                            return (
                              <SelectItem key={gender} value={gender}>
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-slate-400">
                                      {gender === 'male' ? '♂' : gender === 'female' ? '♀' : '⚧'}
                                    </span>
                                    <span>
                                      {gender.charAt(0).toUpperCase() + gender.slice(1)}
                                    </span>
                                  </div>
                                  <span className="text-xs text-slate-500 ml-2">
                                    ({voiceCount})
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Country Filter */}
                  <div className="space-y-2">
                    <Label>Country/Accent</Label>
                    <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-600">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAllCountries().map((countryKey) => {
                          const voiceCount = countryKey === 'all' ? voices.length : voices.filter(voice => voice.labels?.accent === countryKey).length;
                          
                          return (
                            <SelectItem key={countryKey} value={countryKey}>
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-slate-400">
                                    {countryMapping[countryKey as keyof typeof countryMapping]?.code}
                                  </span>
                                  <span>
                                    {countryMapping[countryKey as keyof typeof countryMapping]?.name}
                                  </span>
                                </div>
                                <span className="text-xs text-slate-500 ml-2">
                                  ({voiceCount})
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Voice Selection with Play Button */}
                <div className="space-y-2">
                  <Label>Voice ({getFilteredVoices().length} available)</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-600">
                        <SelectValue placeholder="Select a voice" />
                      </SelectTrigger>
                      <SelectContent>
                        {getFilteredVoices().map((voice) => (
                          <SelectItem key={voice.voice_id} value={voice.name}>
                            <div className="flex items-center gap-2">
                              <span>{voice.name}</span>
                              {voice.labels?.language && (
                                <Badge variant="outline" className="text-xs">
                                  {voice.labels.language.toUpperCase()}
                                </Badge>
                              )}
                              {voice.labels?.gender && (
                                <Badge variant="secondary" className="text-xs">
                                  {voice.labels.gender === 'male' ? '♂' : voice.labels.gender === 'female' ? '♀' : '⚧'} {voice.labels.gender}
                                </Badge>
                              )}
                              {voice.labels?.accent && (
                                <Badge variant="outline" className="text-xs">
                                  {countryMapping[voice.labels.accent as keyof typeof countryMapping]?.code || voice.labels.accent}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    </div>
                    
                    {selectedVoice && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const voice = voices.find(v => v.name === selectedVoice);
                          if (voice) {
                            playVoiceSample(voice.voice_id, voice.name);
                          }
                        }}
                        disabled={playingSample !== null}
                        className="px-3"
                      >
                        {playingSample ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                  
                  {/* Selected Voice Details */}
                  {selectedVoice && (
                    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-600">
                      {(() => {
                        const voice = voices.find(v => v.name === selectedVoice);
                        return voice ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{voice.name}</span>
                              {voice.labels?.language && (
                                <Badge variant="outline" className="text-xs">
                                  {voice.labels.language.toUpperCase()}
                                </Badge>
                              )}
                              {voice.labels?.gender && (
                                <Badge variant="secondary" className="text-xs">
                                  {voice.labels.gender === 'male' ? '♂' : voice.labels.gender === 'female' ? '♀' : '⚧'} {voice.labels.gender}
                                </Badge>
                              )}
                              {voice.labels?.accent && (
                                <Badge variant="outline" className="text-xs">
                                  {countryMapping[voice.labels.accent as keyof typeof countryMapping]?.name || voice.labels.accent}
                                </Badge>
                              )}
                            </div>
                            {voice.labels && (
                              <div className="flex flex-wrap gap-1">
                                {voice.labels.age && (
                                  <Badge variant="outline" className="text-xs">
                                    Age: {voice.labels.age}
                                  </Badge>
                                )}
                                {voice.labels.descriptive && (
                                  <Badge variant="outline" className="text-xs">
                                    {voice.labels.descriptive}
                                  </Badge>
                                )}
                                {voice.labels.use_case && (
                                  <Badge variant="outline" className="text-xs">
                                    {voice.labels.use_case}
                                  </Badge>
                                )}
                              </div>
                            )}
                            {voice.description && (
                              <p className="text-sm text-slate-400">{voice.description}</p>
                            )}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>

                {/* Detailed Voice Data Display */}
                {showDetailedData && detailedVoiceData && (
                  <div className="space-y-2">
                    <Label>Raw ElevenLabs API Response</Label>
                    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-600 max-h-40 overflow-y-auto">
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                        {JSON.stringify(detailedVoiceData, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Duration & Settings */}
            <Card className="bg-slate-900/50 border-purple-500/20 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-purple-300 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Video Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Duration: {duration[0]} seconds</Label>
                  <Slider
                    value={duration}
                    onValueChange={setDuration}
                    max={60}
                    min={15}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>15s</span>
                    <span>60s</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Background Music Volume: {Math.round(backgroundMusic * 100)}%</Label>
                  <Slider
                    value={[backgroundMusic]}
                    onValueChange={(value) => setBackgroundMusic(value[0])}
                    max={1}
                    min={0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button
              onClick={generateAIShort}
              disabled={isGenerating || !selectedVoice}
              className="w-full h-12 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating AI Short...
                </>
              ) : (
                <>
                  <Bot className="mr-2 h-4 w-4" />
                  Generate AI Short
                </>
              )}
            </Button>
          </div>

          {/* Right Column - Preview & Results */}
          <div className="space-y-6">
            {/* Progress */}
            {isGenerating && (
              <Card className="bg-slate-900/50 border-purple-500/20 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-purple-300">Generation Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={progress} className="w-full" />
                  <p className="text-sm text-slate-400 mt-2">
                    Creating your AI short... This may take a few moments.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {result && (
              <Card className="bg-slate-900/50 border-purple-500/20 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-purple-300 flex items-center gap-2">
                    <Image className="h-5 w-5" />
                    Generated Content
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Script Display */}
                  <div className="space-y-2">
                    <Label>Generated Script</Label>
                    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-600">
                      <p className="text-slate-200 text-sm leading-relaxed">{result.script}</p>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-slate-800/30 rounded-lg">
                      <div className="text-lg font-semibold text-purple-400">{result.metadata.duration}s</div>
                      <div className="text-sm text-slate-400">Duration</div>
                    </div>
                    <div className="text-center p-3 bg-slate-800/30 rounded-lg">
                      <div className="text-lg font-semibold text-cyan-400">{result.imagesPaths.length}</div>
                      <div className="text-sm text-slate-400">Images</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={previewAudio}
                      variant="outline"
                      className="flex-1"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Preview Audio
                    </Button>
                    <Button
                      onClick={downloadResult}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>

                  {/* Generated Images Preview */}
                  {result.imagesPaths.length > 0 && (
                    <div className="space-y-2">
                      <Label>Generated Images</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {result.imagesPaths.slice(0, 4).map((imagePath, index) => (
                          <div key={index} className="aspect-video bg-slate-800/50 rounded-lg border border-slate-600 flex items-center justify-center">
                            <Image className="h-8 w-8 text-slate-400" />
                            <span className="text-xs text-slate-400 ml-2">Image {index + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Sample Prompts */}
            {!result && !isGenerating && (
              <Card className="bg-slate-900/50 border-purple-500/20 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-purple-300">Sample Prompts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(samplePrompts).map(([styleKey, samplePrompt]) => (
                    <div
                      key={styleKey}
                      className="p-3 bg-slate-800/30 rounded-lg border border-slate-600 cursor-pointer hover:border-purple-400 transition-colors"
                      onClick={() => {
                        setStyle(styleKey);
                        if (!useScript) setPrompt(samplePrompt);
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="capitalize">
                          {styleKey}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-300">{samplePrompt}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}