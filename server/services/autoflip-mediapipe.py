#!/usr/bin/env python3
"""
Google AutoFlip-inspired intelligent video reframing using MediaPipe
Based on https://opensource.googleblog.com/2020/02/autoflip-open-source-framework-for.html

This implementation uses MediaPipe's object detection, pose estimation, and face detection
to identify salient regions and automatically crop videos while preserving focus areas.
"""

import cv2
import mediapipe as mp
import numpy as np
import json
import sys
import os
from typing import List, Dict, Tuple, Optional
import argparse

class AutoFlipMediaPipe:
    def __init__(self):
        # Initialize MediaPipe solutions
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles
        
        # Face detection for person identification
        self.mp_face_detection = mp.solutions.face_detection
        self.face_detection = self.mp_face_detection.FaceDetection(
            model_selection=0, min_detection_confidence=0.5)
        
        # Pose detection for body tracking
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5)
        
        # Holistic for comprehensive detection
        self.mp_holistic = mp.solutions.holistic
        self.holistic = self.mp_holistic.Holistic(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5)
    
    def detect_salient_regions(self, frame: np.ndarray) -> Dict:
        """
        Detect salient regions in the frame using MediaPipe.
        Returns regions of interest with confidence scores.
        """
        height, width = frame.shape[:2]
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        salient_regions = {
            'faces': [],
            'poses': [],
            'hands': [],
            'overall_bbox': None,
            'confidence': 0.0
        }
        
        # Face detection
        face_results = self.face_detection.process(rgb_frame)
        if face_results.detections:
            for detection in face_results.detections:
                bbox = detection.location_data.relative_bounding_box
                x = int(bbox.xmin * width)
                y = int(bbox.ymin * height)
                w = int(bbox.width * width)
                h = int(bbox.height * height)
                
                salient_regions['faces'].append({
                    'bbox': [x, y, w, h],
                    'confidence': detection.score[0],
                    'normalized_bbox': [bbox.xmin, bbox.ymin, bbox.width, bbox.height]
                })
        
        # Holistic detection (pose + hands + face landmarks)
        holistic_results = self.holistic.process(rgb_frame)
        
        # Pose landmarks
        if holistic_results.pose_landmarks:
            landmarks = []
            for landmark in holistic_results.pose_landmarks.landmark:
                landmarks.append({
                    'x': landmark.x,
                    'y': landmark.y,
                    'z': landmark.z,
                    'visibility': landmark.visibility
                })
            
            # Calculate pose bounding box
            visible_landmarks = [lm for lm in landmarks if lm['visibility'] > 0.5]
            if visible_landmarks:
                x_coords = [lm['x'] for lm in visible_landmarks]
                y_coords = [lm['y'] for lm in visible_landmarks]
                
                min_x, max_x = min(x_coords), max(x_coords)
                min_y, max_y = min(y_coords), max(y_coords)
                
                # Add padding
                padding = 0.1
                min_x = max(0, min_x - padding)
                min_y = max(0, min_y - padding)
                max_x = min(1, max_x + padding)
                max_y = min(1, max_y + padding)
                
                salient_regions['poses'].append({
                    'bbox': [
                        int(min_x * width),
                        int(min_y * height),
                        int((max_x - min_x) * width),
                        int((max_y - min_y) * height)
                    ],
                    'confidence': 0.9,
                    'normalized_bbox': [min_x, min_y, max_x - min_x, max_y - min_y],
                    'landmarks': landmarks
                })
        
        # Hand landmarks
        if holistic_results.left_hand_landmarks or holistic_results.right_hand_landmarks:
            for hand_landmarks, hand_type in [
                (holistic_results.left_hand_landmarks, 'left'),
                (holistic_results.right_hand_landmarks, 'right')
            ]:
                if hand_landmarks:
                    hand_points = []
                    for landmark in hand_landmarks.landmark:
                        hand_points.append({
                            'x': landmark.x,
                            'y': landmark.y,
                            'z': landmark.z
                        })
                    
                    # Calculate hand bounding box
                    x_coords = [p['x'] for p in hand_points]
                    y_coords = [p['y'] for p in hand_points]
                    
                    min_x, max_x = min(x_coords), max(x_coords)
                    min_y, max_y = min(y_coords), max(y_coords)
                    
                    salient_regions['hands'].append({
                        'type': hand_type,
                        'bbox': [
                            int(min_x * width),
                            int(min_y * height),
                            int((max_x - min_x) * width),
                            int((max_y - min_y) * height)
                        ],
                        'confidence': 0.8,
                        'normalized_bbox': [min_x, min_y, max_x - min_x, max_y - min_y],
                        'landmarks': hand_points
                    })
        
        # Calculate overall bounding box encompassing all salient regions
        all_regions = []
        all_regions.extend([r['normalized_bbox'] for r in salient_regions['faces']])
        all_regions.extend([r['normalized_bbox'] for r in salient_regions['poses']])
        all_regions.extend([r['normalized_bbox'] for r in salient_regions['hands']])
        
        if all_regions:
            min_x = min([r[0] for r in all_regions])
            min_y = min([r[1] for r in all_regions])
            max_x = max([r[0] + r[2] for r in all_regions])
            max_y = max([r[1] + r[3] for r in all_regions])
            
            salient_regions['overall_bbox'] = {
                'normalized': [min_x, min_y, max_x - min_x, max_y - min_y],
                'absolute': [
                    int(min_x * width),
                    int(min_y * height),
                    int((max_x - min_x) * width),
                    int((max_y - min_y) * height)
                ]
            }
            
            # Calculate overall confidence
            total_confidence = 0
            total_regions = 0
            for region_type in ['faces', 'poses', 'hands']:
                for region in salient_regions[region_type]:
                    total_confidence += region['confidence']
                    total_regions += 1
            
            salient_regions['confidence'] = total_confidence / max(1, total_regions)
        
        return salient_regions
    
    def calculate_autoflip_crop(self, frame_width: int, frame_height: int, 
                               salient_regions: Dict, target_aspect_ratio: str) -> Dict:
        """
        Calculate optimal crop area using AutoFlip algorithm principles.
        Maintains salient content while achieving target aspect ratio.
        """
        # Parse target aspect ratio
        if target_aspect_ratio == '9:16':
            target_ratio = 9 / 16
        elif target_aspect_ratio == '16:9':
            target_ratio = 16 / 9
        elif target_aspect_ratio == '1:1':
            target_ratio = 1.0
        elif target_aspect_ratio == '4:3':
            target_ratio = 4 / 3
        else:
            target_ratio = 9 / 16  # Default to portrait
        
        current_ratio = frame_width / frame_height
        
        crop_info = {
            'x': 0,
            'y': 0,
            'width': frame_width,
            'height': frame_height,
            'confidence': 0.0,
            'method': 'center_crop'
        }
        
        if salient_regions['overall_bbox']:
            # Use salient region as guide for cropping
            bbox = salient_regions['overall_bbox']['normalized']
            
            # Calculate center of salient region
            center_x = bbox[0] + bbox[2] / 2
            center_y = bbox[1] + bbox[3] / 2
            
            # Determine crop dimensions based on target aspect ratio
            if target_ratio < current_ratio:
                # Need to crop width (portrait from landscape)
                crop_height = frame_height
                crop_width = int(crop_height * target_ratio)
                
                # Center crop around salient region
                crop_x = int((center_x * frame_width) - (crop_width / 2))
                crop_x = max(0, min(crop_x, frame_width - crop_width))
                crop_y = 0
                
            else:
                # Need to crop height (landscape from portrait, or square)
                crop_width = frame_width
                crop_height = int(crop_width / target_ratio)
                
                # Center crop around salient region
                crop_y = int((center_y * frame_height) - (crop_height / 2))
                crop_y = max(0, min(crop_y, frame_height - crop_height))
                crop_x = 0
            
            crop_info.update({
                'x': crop_x,
                'y': crop_y,
                'width': crop_width,
                'height': crop_height,
                'confidence': salient_regions['confidence'],
                'method': 'autoflip_salient',
                'center_x': center_x,
                'center_y': center_y,
                'salient_bbox': bbox
            })
        
        else:
            # Fallback to center crop if no salient regions detected
            if target_ratio < current_ratio:
                crop_height = frame_height
                crop_width = int(crop_height * target_ratio)
                crop_x = (frame_width - crop_width) // 2
                crop_y = 0
            else:
                crop_width = frame_width
                crop_height = int(crop_width / target_ratio)
                crop_x = 0
                crop_y = (frame_height - crop_height) // 2
            
            crop_info.update({
                'x': crop_x,
                'y': crop_y,
                'width': crop_width,
                'height': crop_height,
                'confidence': 0.1,
                'method': 'center_crop_fallback'
            })
        
        return crop_info
    
    def process_video_autoflip(self, input_path: str, output_path: str, 
                              target_aspect_ratio: str = '9:16',
                              sample_rate: int = 30) -> Dict:
        """
        Process video using AutoFlip-inspired algorithm with MediaPipe.
        """
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            return {'error': 'Could not open video file'}
        
        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        # Sample frames for analysis
        sample_interval = max(1, frame_count // sample_rate)
        frame_analyses = []
        
        print(f"Analyzing video: {frame_width}x{frame_height}, {frame_count} frames, {fps} fps")
        print(f"Sampling every {sample_interval} frames for AutoFlip analysis")
        
        frame_idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Sample frames for analysis
            if frame_idx % sample_interval == 0:
                salient_regions = self.detect_salient_regions(frame)
                crop_info = self.calculate_autoflip_crop(
                    frame_width, frame_height, salient_regions, target_aspect_ratio)
                
                frame_analyses.append({
                    'frame_idx': frame_idx,
                    'timestamp': frame_idx / fps,
                    'salient_regions': salient_regions,
                    'crop_info': crop_info
                })
                
                print(f"Frame {frame_idx}: {len(salient_regions['faces'])} faces, "
                      f"{len(salient_regions['poses'])} poses, "
                      f"confidence: {salient_regions['confidence']:.2f}")
            
            frame_idx += 1
        
        cap.release()
        
        # Smooth crop transitions between keyframes
        smoothed_crops = self.smooth_crop_transitions(frame_analyses, frame_count, fps)
        
        # Generate output
        result = {
            'input_path': input_path,
            'output_path': output_path,
            'target_aspect_ratio': target_aspect_ratio,
            'original_dimensions': [frame_width, frame_height],
            'frame_count': frame_count,
            'fps': fps,
            'sample_rate': sample_rate,
            'frame_analyses': frame_analyses,
            'smoothed_crops': smoothed_crops,
            'processing_stats': {
                'total_faces_detected': sum(len(fa['salient_regions']['faces']) for fa in frame_analyses),
                'total_poses_detected': sum(len(fa['salient_regions']['poses']) for fa in frame_analyses),
                'average_confidence': sum(fa['salient_regions']['confidence'] for fa in frame_analyses) / len(frame_analyses) if frame_analyses else 0,
                'frames_with_salient_content': sum(1 for fa in frame_analyses if fa['salient_regions']['overall_bbox'])
            }
        }
        
        return result
    
    def smooth_crop_transitions(self, frame_analyses: List[Dict], 
                               total_frames: int, fps: float) -> List[Dict]:
        """
        Smooth crop transitions between keyframes to prevent jarring movements.
        Uses temporal smoothing similar to AutoFlip's approach.
        """
        if not frame_analyses:
            return []
        
        smoothed_crops = []
        
        for i in range(len(frame_analyses) - 1):
            current_analysis = frame_analyses[i]
            next_analysis = frame_analyses[i + 1]
            
            current_frame = current_analysis['frame_idx']
            next_frame = next_analysis['frame_idx']
            
            current_crop = current_analysis['crop_info']
            next_crop = next_analysis['crop_info']
            
            # Interpolate between current and next crop
            frame_diff = next_frame - current_frame
            
            for frame_offset in range(frame_diff):
                interpolation_factor = frame_offset / frame_diff if frame_diff > 0 else 0
                
                interpolated_crop = {
                    'frame_idx': current_frame + frame_offset,
                    'timestamp': (current_frame + frame_offset) / fps,
                    'x': int(current_crop['x'] + (next_crop['x'] - current_crop['x']) * interpolation_factor),
                    'y': int(current_crop['y'] + (next_crop['y'] - current_crop['y']) * interpolation_factor),
                    'width': int(current_crop['width'] + (next_crop['width'] - current_crop['width']) * interpolation_factor),
                    'height': int(current_crop['height'] + (next_crop['height'] - current_crop['height']) * interpolation_factor),
                    'confidence': current_crop['confidence'] + (next_crop['confidence'] - current_crop['confidence']) * interpolation_factor,
                    'method': 'interpolated'
                }
                
                smoothed_crops.append(interpolated_crop)
        
        # Add the last frame
        if frame_analyses:
            last_analysis = frame_analyses[-1]
            last_crop = last_analysis['crop_info']
            smoothed_crops.append({
                'frame_idx': last_analysis['frame_idx'],
                'timestamp': last_analysis['timestamp'],
                'x': last_crop['x'],
                'y': last_crop['y'],
                'width': last_crop['width'],
                'height': last_crop['height'],
                'confidence': last_crop['confidence'],
                'method': last_crop['method']
            })
        
        return smoothed_crops

def main():
    parser = argparse.ArgumentParser(description='AutoFlip-inspired video reframing with MediaPipe')
    parser.add_argument('input_video', help='Input video path')
    parser.add_argument('output_json', help='Output JSON path for analysis results')
    parser.add_argument('--aspect-ratio', default='9:16', choices=['9:16', '16:9', '1:1', '4:3'],
                       help='Target aspect ratio')
    parser.add_argument('--sample-rate', type=int, default=30,
                       help='Number of frames to sample for analysis')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input_video):
        print(f"Error: Input video file not found: {args.input_video}")
        sys.exit(1)
    
    autoflip = AutoFlipMediaPipe()
    
    print("Starting AutoFlip-inspired video analysis with MediaPipe...")
    result = autoflip.process_video_autoflip(
        args.input_video,
        args.output_json,
        args.aspect_ratio,
        args.sample_rate
    )
    
    if 'error' in result:
        print(f"Error: {result['error']}")
        sys.exit(1)
    
    # Save results to JSON
    with open(args.output_json, 'w') as f:
        json.dump(result, f, indent=2)
    
    print(f"AutoFlip analysis completed successfully!")
    print(f"Results saved to: {args.output_json}")
    print(f"Processing stats: {result['processing_stats']}")

if __name__ == "__main__":
    main()