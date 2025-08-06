import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Users, Zap, Play, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  requiredInputs: string[];
  expectedOutputs: string[];
}

interface TemplateGalleryProps {
  onSelectTemplate: (template: WorkflowTemplate) => void;
}

export default function TemplateGallery({ onSelectTemplate }: TemplateGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const { data: templates, isLoading } = useQuery<WorkflowTemplate[]>({
    queryKey: ["/api/templates"],
  });

  const categories = ["all", "Social Media", "Localization", "Content Creation", "Professional"];

  const filteredTemplates = templates?.filter(template => 
    selectedCategory === "all" || template.category === selectedCategory
  ) || [];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return <Zap className="w-3 h-3" />;
      case 'intermediate': return <Users className="w-3 h-3" />;
      case 'advanced': return <Star className="w-3 h-3" />;
      default: return null;
    }
  };

  const handleSelectTemplate = (template: WorkflowTemplate) => {
    onSelectTemplate(template);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-google-blue hover:bg-blue-600 text-white">
          <Play className="w-4 h-4 mr-2" />
          Browse Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-google-text">
            Workflow Templates
          </DialogTitle>
          <DialogDescription>
            Choose from pre-built workflow templates to get started quickly with your video editing projects.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            {categories.map((category) => (
              <TabsTrigger key={category} value={category} className="capitalize">
                {category}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-6 max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-google-blue border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTemplates.map((template) => (
                  <Card key={template.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-medium text-google-text">
                          {template.name}
                        </CardTitle>
                        <Badge 
                          className={`text-xs ${getDifficultyColor(template.difficulty)} flex items-center gap-1`}
                        >
                          {getDifficultyIcon(template.difficulty)}
                          {template.difficulty}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm text-gray-600">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="flex items-center text-sm text-gray-500">
                          <Clock className="w-4 h-4 mr-2" />
                          {template.estimatedTime}
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-medium text-gray-700 mb-1">Required Inputs:</p>
                            <div className="flex flex-wrap gap-1">
                              {template.requiredInputs.slice(0, 2).map((input, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {input}
                                </Badge>
                              ))}
                              {template.requiredInputs.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{template.requiredInputs.length - 2} more
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-xs font-medium text-gray-700 mb-1">Expected Outputs:</p>
                            <div className="flex flex-wrap gap-1">
                              {template.expectedOutputs.slice(0, 2).map((output, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {output}
                                </Badge>
                              ))}
                              {template.expectedOutputs.length > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{template.expectedOutputs.length - 2} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <Button 
                          onClick={() => handleSelectTemplate(template)}
                          className="w-full bg-google-blue hover:bg-blue-600 text-white text-sm"
                        >
                          Use Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}