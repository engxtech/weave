import fs from 'fs';
import path from 'path';

// Professional text styles for standard editing tools compatibility
export interface TextStyleOptions {
  style: 'bold' | 'italic' | 'underline' | 'outlined' | 'shadow' | 'neon' | 'retro' | 'cinematic' | 'gradient' | 'glitch';
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  strokeColor?: string;
  strokeWidth?: number;
  gradientColors?: string[];
  alignment: 'left' | 'center' | 'right';
  position: { x: number; y: number };
  rotation?: number;
  scale?: number;
  opacity?: number;
  animationType?: 'fade' | 'slide' | 'zoom' | 'bounce' | 'typewriter' | 'reveal';
  animationDuration?: number;
  letterSpacing?: number;
  lineHeight?: number;
}

export class RevideoTextStyles {

  /**
   * Generate Revideo scene with professional text styling
   * Compatible with Adobe Premiere Pro, DaVinci Resolve, Final Cut Pro standards
   */
  generateStyledTextScene(
    text: string,
    startTime: number,
    endTime: number,
    style: TextStyleOptions,
    sceneName: string = 'styledText'
  ): string {
    
    const duration = endTime - startTime;
    const { textStyleCode, animationCode } = this.generateTextStyleCode(style);
    
    return `
import { Txt, makeScene2D, Layout } from '@revideo/2d';
import { createRef, waitFor, all, tween, easeInOutCubic } from '@revideo/core';

export default makeScene2D(function* (view) {
  const textRef = createRef<Txt>();
  const containerRef = createRef<Layout>();

  view.add(
    <Layout 
      ref={containerRef}
      x={${style.position.x}}
      y={${style.position.y}}
      rotation={${style.rotation || 0}}
      scale={${style.scale || 1}}
      opacity={${style.opacity || 1}}
    >
      <Txt
        ref={textRef}
        text="${text.replace(/"/g, '\\"')}"
        fontSize={${style.fontSize}}
        fontFamily="${style.fontFamily}"
        fill="${style.color}"
        textAlign="${style.alignment}"
        letterSpacing={${style.letterSpacing || 0}}
        lineHeight={${style.lineHeight || 1.2}}
        ${textStyleCode}
      />
    </Layout>
  );

  // Animation sequence
  yield* all(
    ${animationCode}
    waitFor(${duration})
  );
});`;
  }

  /**
   * Generate text style code based on selected style
   */
  private generateTextStyleCode(style: TextStyleOptions): { textStyleCode: string; animationCode: string } {
    let textStyleCode = '';
    let animationCode = '';

    switch (style.style) {
      case 'bold':
        textStyleCode = `fontWeight={800}`;
        animationCode = `textRef().scale(0.8, 0).to(1, 0.3)`;
        break;
        
      case 'italic':
        textStyleCode = `fontStyle="italic"`;
        animationCode = `textRef().skew.x(-10, 0).to(0, 0.3)`;
        break;
        
      case 'outlined':
        textStyleCode = `
          stroke="${style.strokeColor || '#000000'}"
          strokeWidth={${style.strokeWidth || 4}}
          strokeFirst={true}
        `;
        animationCode = `textRef().strokeWidth(0, 0).to(${style.strokeWidth || 4}, 0.5)`;
        break;
        
      case 'shadow':
        textStyleCode = `
          shadowColor="${style.shadowColor || '#000000'}"
          shadowBlur={${style.shadowBlur || 10}}
          shadowOffset={[${style.shadowOffsetX || 4}, ${style.shadowOffsetY || 4}]}
        `;
        animationCode = `textRef().shadowBlur(0, 0).to(${style.shadowBlur || 10}, 0.4)`;
        break;
        
      case 'neon':
        textStyleCode = `
          fill="${style.color}"
          stroke="${style.color}"
          strokeWidth={2}
          shadowColor="${style.color}"
          shadowBlur={20}
          filters.glow={{color: "${style.color}", strength: 3}}
        `;
        animationCode = `
          textRef().filters.glow({color: "${style.color}", strength: 0}, 0).to({color: "${style.color}", strength: 3}, 0.6),
          textRef().shadowBlur(0, 0).to(20, 0.6)
        `;
        break;
        
      case 'gradient':
        const gradientColors = style.gradientColors || [style.color, '#ff6b6b'];
        textStyleCode = `
          fill={{
            type: 'linear',
            from: [0, -50],
            to: [0, 50],
            stops: [
              {offset: 0, color: "${gradientColors[0]}"},
              {offset: 1, color: "${gradientColors[1] || gradientColors[0]}"}
            ]
          }}
        `;
        animationCode = `textRef().opacity(0, 0).to(1, 0.5)`;
        break;
        
      case 'retro':
        textStyleCode = `
          fontFamily="'Courier New', monospace"
          fill="${style.color}"
          stroke="#000000"
          strokeWidth={1}
          shadowColor="#ff00ff"
          shadowOffset={[2, 2]}
          shadowBlur={0}
        `;
        animationCode = `
          textRef().scale(1.2, 0).to(1, 0.4),
          textRef().rotation(-2, 0).to(0, 0.4)
        `;
        break;
        
      case 'cinematic':
        textStyleCode = `
          fontFamily="'Times New Roman', serif"
          fill="${style.color}"
          letterSpacing={2}
          shadowColor="rgba(0,0,0,0.8)"
          shadowOffset={[0, 4]}
          shadowBlur={8}
        `;
        animationCode = `
          textRef().position.y(textRef().position.y() + 50, 0).to(textRef().position.y(), 0.8),
          textRef().opacity(0, 0).to(1, 0.8)
        `;
        break;
        
      case 'glitch':
        textStyleCode = `
          fill="${style.color}"
          stroke="#00ff00"
          strokeWidth={1}
        `;
        animationCode = `
          textRef().position.x(textRef().position.x() - 5, 0).to(textRef().position.x() + 5, 0.1).to(textRef().position.x(), 0.1),
          textRef().filters.brightness(1, 0).to(1.5, 0.1).to(1, 0.1)
        `;
        break;
        
      default:
        textStyleCode = '';
        animationCode = `textRef().opacity(0, 0).to(1, 0.3)`;
    }

    // Add animation type modifications
    if (style.animationType) {
      switch (style.animationType) {
        case 'slide':
          animationCode = `textRef().position.x(textRef().position.x() - 200, 0).to(textRef().position.x(), 0.5)`;
          break;
        case 'zoom':
          animationCode = `textRef().scale(0, 0).to(1, 0.4)`;
          break;
        case 'bounce':
          animationCode = `textRef().scale(0, 0).to(1.2, 0.3).to(1, 0.2)`;
          break;
        case 'typewriter':
          animationCode = `textRef().text("", 0).to("${text.replace(/"/g, '\\"')}", ${style.animationDuration || 1})`;
          break;
      }
    }

    return { textStyleCode, animationCode };
  }

  /**
   * Save styled text scene to file system
   */
  async saveStyledTextScene(
    text: string,
    startTime: number,
    endTime: number,
    style: TextStyleOptions,
    outputPath?: string
  ): Promise<string> {
    
    const sceneName = `styledText_${Date.now()}`;
    const sceneContent = this.generateStyledTextScene(text, startTime, endTime, style, sceneName);
    
    const scenesDir = path.join(process.cwd(), 'revideo/scenes');
    if (!fs.existsSync(scenesDir)) {
      fs.mkdirSync(scenesDir, { recursive: true });
    }
    
    const filePath = outputPath || path.join(scenesDir, `${sceneName}.tsx`);
    fs.writeFileSync(filePath, sceneContent);
    
    console.log(`[RevideoTextStyles] Styled text scene saved: ${filePath}`);
    return filePath;
  }

  /**
   * Get preset text styles matching standard editing tools
   */
  static getPresetStyles(): Record<string, Partial<TextStyleOptions>> {
    return {
      'Adobe Premiere Title': {
        style: 'bold',
        fontSize: 72,
        fontFamily: 'Arial',
        color: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 2,
        alignment: 'center',
        animationType: 'fade'
      },
      'DaVinci Resolve Subtitle': {
        style: 'shadow',
        fontSize: 48,
        fontFamily: 'Arial',
        color: '#ffffff',
        shadowColor: '#000000',
        shadowBlur: 4,
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        alignment: 'center'
      },
      'Final Cut Pro Lower Third': {
        style: 'outlined',
        fontSize: 36,
        fontFamily: 'Helvetica',
        color: '#ffffff',
        strokeColor: '#1e40af',
        strokeWidth: 3,
        alignment: 'left',
        animationType: 'slide'
      },
      'YouTube Shorts Caption': {
        style: 'bold',
        fontSize: 80,
        fontFamily: 'Arial',
        color: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 4,
        alignment: 'center',
        animationType: 'zoom'
      },
      'Instagram Story Text': {
        style: 'neon',
        fontSize: 64,
        fontFamily: 'Arial',
        color: '#ff6b6b',
        alignment: 'center',
        animationType: 'bounce'
      },
      'TikTok Trending Style': {
        style: 'glitch',
        fontSize: 72,
        fontFamily: 'Arial',
        color: '#00ff00',
        strokeColor: '#ff00ff',
        strokeWidth: 2,
        alignment: 'center',
        animationType: 'reveal'
      },
      'Netflix Documentary': {
        style: 'cinematic',
        fontSize: 56,
        fontFamily: 'Times New Roman',
        color: '#ffffff',
        shadowColor: 'rgba(0,0,0,0.8)',
        shadowBlur: 8,
        alignment: 'center',
        letterSpacing: 1,
        animationType: 'fade'
      },
      'Retro Gaming': {
        style: 'retro',
        fontSize: 48,
        fontFamily: 'Courier New',
        color: '#00ff00',
        strokeColor: '#000000',
        strokeWidth: 1,
        shadowColor: '#ff00ff',
        alignment: 'center',
        animationType: 'typewriter'
      }
    };
  }
}