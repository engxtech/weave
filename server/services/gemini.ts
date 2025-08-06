import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  private ai: GoogleGenAI;
  
  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateResponse(message: string, model: string = "gemini-2.0-flash-exp"): Promise<string> {
    try {
      const systemPrompt = `You are an AI video editing assistant for a professional video editing platform. 
You help users create and optimize video editing workflows using various processing tiles like Voice (for translation and cloning), 
Captions (for auto-generated subtitles), Audio Enhancement, Cut operations, B-Roll insertion, Music addition, and AI agents 
like the Curator Agent (for transforming long-form content into shorts) and Linguist Agent (for localization).

You can:
- Help users understand how different editing tiles work
- Suggest workflow optimizations
- Explain video editing concepts
- Recommend combinations of tiles for specific goals
- Provide guidance on settings and configurations
- Help troubleshoot workflow issues

Be helpful, concise, and focus on practical video editing advice. When suggesting workflows, 
mention specific tiles that would be useful and how they should be connected.`;

      const response = await this.ai.models.generateContent({
        model,
        config: {
          systemInstruction: systemPrompt,
        },
        contents: [{
          role: "user",
          parts: [{ text: message }]
        }]
      });

      return response.text || "I'm sorry, I couldn't process that request. Please try again.";
    } catch (error) {
      console.error("Gemini API error:", error);
      throw new Error("Failed to generate AI response. Please check your API key and try again.");
    }
  }

  async analyzeWorkflow(nodes: any[], edges: any[]): Promise<string> {
    try {
      const workflowDescription = this.describeWorkflow(nodes, edges);
      
      const analysisPrompt = `Analyze this video editing workflow and provide suggestions for improvement:

${workflowDescription}

Please provide:
1. Overall workflow assessment
2. Potential optimizations
3. Missing steps that could improve the result
4. Best practices recommendations`;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [{
          role: "user",
          parts: [{ text: analysisPrompt }]
        }]
      });

      return response.text || "Unable to analyze the workflow at this time.";
    } catch (error) {
      console.error("Workflow analysis error:", error);
      throw new Error("Failed to analyze workflow. Please try again.");
    }
  }

  async suggestWorkflowForGoal(goal: string): Promise<{
    nodes: any[];
    edges: any[];
    description: string;
  }> {
    try {
      const prompt = `Create a video editing workflow for this goal: "${goal}"

Available tiles:
- Video Input: Starting point for video content
- Voice: Change spoken words, translate with voice cloning
- Captions: Auto-generate and style subtitles
- Audio Enhance: Improve audio quality with noise reduction
- Cut: Trim and edit video content
- B-Roll: Add supplementary footage
- Music: Add background music
- Curator Agent: Transform long-form content into shorts
- Linguist Agent: Localize content for global audiences

Respond with a JSON object containing:
{
  "description": "Brief explanation of the workflow",
  "steps": [
    {
      "tile": "tile-name",
      "purpose": "why this tile is needed",
      "settings": "key settings to configure"
    }
  ]
}`;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        config: {
          responseMimeType: "application/json"
        },
        contents: [{
          role: "user",
          parts: [{ text: prompt }]
        }]
      });

      const result = JSON.parse(response.text || "{}");
      
      // Convert the AI response into actual workflow nodes and edges
      const nodes = this.createNodesFromSteps(result.steps || []);
      const edges = this.createEdgesFromNodes(nodes);

      return {
        nodes,
        edges,
        description: result.description || "Workflow generated based on your goal."
      };
    } catch (error) {
      console.error("Workflow suggestion error:", error);
      throw new Error("Failed to generate workflow suggestion. Please try again.");
    }
  }

  private describeWorkflow(nodes: any[], edges: any[]): string {
    if (!nodes.length) {
      return "Empty workflow with no processing steps.";
    }

    let description = `Workflow with ${nodes.length} nodes:\n`;
    
    nodes.forEach((node, index) => {
      description += `${index + 1}. ${node.data.label}`;
      if (node.data.settings && Object.keys(node.data.settings).length > 0) {
        const settings = Object.entries(node.data.settings)
          .slice(0, 2)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ");
        description += ` (${settings})`;
      }
      description += "\n";
    });

    if (edges.length > 0) {
      description += `\nConnections: ${edges.length} connections between nodes showing the processing flow.`;
    }

    return description;
  }

  private createNodesFromSteps(steps: any[]): any[] {
    const nodes = [];
    
    // Always start with Video Input
    nodes.push({
      id: "video-input",
      type: "workflowTile",
      position: { x: 100, y: 100 },
      data: {
        label: "Video Input",
        icon: "Video",
        color: "bg-google-blue",
        settings: {},
        status: "ready"
      }
    });

    // Add nodes for each step
    steps.forEach((step, index) => {
      const nodeId = `${step.tile}-${Date.now()}-${index}`;
      const position = {
        x: 100 + (index + 1) * 300,
        y: 100 + (index % 2) * 150
      };

      nodes.push({
        id: nodeId,
        type: "workflowTile",
        position,
        data: {
          label: this.getTileDisplayName(step.tile),
          icon: this.getTileIcon(step.tile),
          color: this.getTileColor(step.tile),
          settings: this.getDefaultSettings(step.tile),
          status: "ready"
        }
      });
    });

    return nodes;
  }

  private createEdgesFromNodes(nodes: any[]): any[] {
    const edges = [];
    
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: `edge-${i}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
        type: "smoothstep",
        style: { stroke: "#4285F4", strokeWidth: 2 }
      });
    }

    return edges;
  }

  private getTileDisplayName(tileName: string): string {
    const nameMap: Record<string, string> = {
      "voice": "Voice",
      "captions": "Captions",
      "audio-enhance": "Audio Enhance",
      "cut": "Cut",
      "b-roll": "B-Roll",
      "music": "Music",
      "curator-agent": "Curator Agent",
      "linguist-agent": "Linguist Agent"
    };
    return nameMap[tileName] || tileName;
  }

  private getTileIcon(tileName: string): string {
    const iconMap: Record<string, string> = {
      "voice": "Mic",
      "captions": "Subtitles",
      "audio-enhance": "Volume2",
      "cut": "Scissors",
      "b-roll": "Film",
      "music": "Music4",
      "curator-agent": "Sparkles",
      "linguist-agent": "Languages",
      "reframe": "Crop",
      "background": "Image",
      "eye-contact": "Eye"
    };
    return iconMap[tileName] || "Square";
  }

  private getTileColor(tileName: string): string {
    const colorMap: Record<string, string> = {
      "voice": "bg-google-blue",
      "captions": "bg-gemini-green",
      "audio-enhance": "bg-google-yellow",
      "cut": "bg-google-red",
      "b-roll": "bg-purple-500",
      "music": "bg-indigo-500",
      "curator-agent": "bg-gradient-to-r from-google-blue to-purple-500",
      "linguist-agent": "bg-gradient-to-r from-gemini-green to-google-blue"
    };
    return colorMap[tileName] || "bg-gray-500";
  }

  private getDefaultSettings(tileName: string): Record<string, any> {
    const settingsMap: Record<string, Record<string, any>> = {
      "voice": {
        targetLanguage: "Spanish",
        voiceCloning: true
      },
      "captions": {
        style: "Modern",
        position: "Bottom Center"
      },
      "audio-enhance": {
        noiseReduction: "High",
        enhancement: "Clarity"
      },
      "cut": {
        startTime: "00:00:00",
        endTime: "00:01:00"
      },
      "b-roll": {
        source: "Stock Library"
      },
      "music": {
        volume: 0.3,
        fadeIn: true
      },
      "curator-agent": {
        outputFormat: "Shorts"
      },
      "linguist-agent": {
        targetLanguages: ["Spanish", "French"]
      },
      "reframe": {
        aspectRatio: "Vertical (9:16)",
        autoDetect: true
      },
      "background": {
        processingEngine: "Parallel (Faster)",
        backgroundColor: "Blue"
      },
      "eye-contact": {
        accuracyBoost: true,
        naturalLookAway: false
      }
    };
    return settingsMap[tileName] || {};
  }
}

export const createGeminiService = (apiKey: string): GeminiService => {
  return new GeminiService(apiKey);
};
