import {makeProject} from '@revideo/core';
import exampleScene from './scenes/example';
import videoEditingScene from './scenes/videoEditing';
import subtitleScene from './scenes/subtitles';
import transitionScene from './scenes/transitions';

export default makeProject({
  scenes: [
    exampleScene,
    videoEditingScene, 
    subtitleScene,
    transitionScene
  ],
  variables: {
    // Video inputs - will be replaced dynamically
    primaryVideo: 'https://revideo-example-assets.s3.amazonaws.com/stars.mp4',
    secondaryVideo: '',
    audioTrack: '',
    
    // Text overlays
    titleText: 'AI Video Editor',
    subtitleText: 'Create professional videos with code',
    
    // Animation settings
    animationSpeed: 1.0,
    transitionDuration: 1.0,
    
    // Style settings
    primaryColor: '#8B5CF6', // Purple
    secondaryColor: '#06B6D4', // Cyan
    backgroundColor: '#0F172A', // Dark slate
    
    // Output settings
    outputWidth: 1920,
    outputHeight: 1080,
    outputFrameRate: 30,
    outputDuration: 10,
    
    // Subtitle settings
    subtitleTextContent: 'Welcome to AI Video Editor',
    subtitleFontSize: 48,
    subtitleColor: '#FFFFFF',
    subtitleBackgroundColor: 'rgba(0,0,0,0.8)',
    
    // Audio settings
    audioVolume: 0.8,
    musicVolume: 0.3,
    
    // Logo and branding
    logoUrl: '',
    brandingPosition: 'bottom-right'
  },
});