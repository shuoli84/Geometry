//
//  LabelView.swift
//  Geometry
//
//  Created by LiShuo on 7/23/15.
//  Copyright (c) 2015 LiShuo. All rights reserved.
//

import Foundation
import UIKit


class LabelView: UIView {
    var labelRect = CGRectMake(80, 100, 100, 40)
    var point = CGPointMake(0, 0)
    
    var rectLayer = CAShapeLayer()
    var triangleLayer = CAShapeLayer()
    
    required init(coder aDecoder: NSCoder) {
        super.init(coder: aDecoder)
        
        setupLayer()
    }
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        
        setupLayer()
    }
    
    func setupLayer() {
        rectLayer.fillColor = UIColor.cyanColor().CGColor
        self.layer.addSublayer(rectLayer)
        
        triangleLayer.fillColor = UIColor.redColor().CGColor
        self.layer.addSublayer(triangleLayer) 
    }
   
    override func drawRect(rect: CGRect) {
        var context = UIGraphicsGetCurrentContext()
        CGContextSetFillColorWithColor(context, UIColor.grayColor().CGColor)
        UIBezierPath(rect: self.bounds).fill()
      
        CGContextSetFillColorWithColor(context, UIColor.purpleColor().CGColor)
        UIBezierPath(ovalInRect: CGRectMake(point.x - 2, point.y - 2, 4, 4)).fill()
    }
    
    override func touchesMoved(touches: Set<NSObject>, withEvent event: UIEvent) {
        if let t = touches.first as? UITouch {
            var p = t.locationInView(self)
            p.y = p.y - 40
            
            point = p
            labelRect = positionRectInRectCloseToPoint(labelRect, self.bounds, point, 100, 10)
            
            let triangle = tailTriangleForBubble(labelRect, point, 10)
            
            /*
                CABasicAnimation *fillColorAnimation = [CABasicAnimation animationWithKeyPath:@"fillColor"];
                fillColorAnimation.duration = 1.5f;
                fillColorAnimation.fromValue = (id)[[UIColor clearColor] CGColor];
                fillColorAnimation.toValue = (id)[[UIColor yellowColor] CGColor];
                fillColorAnimation.repeatCount = 10;
                fillColorAnimation.autoreverses = YES;
                [myShapeLayer addAnimation:fillColorAnimation forKey:@"fillColor"];
            */
            
            let path = UIBezierPath(rect: labelRect).CGPath
            var animation = CABasicAnimation(keyPath: "path")
            
            animation.duration = 0.3
            animation.fromValue = rectLayer.path
            animation.toValue = path
            rectLayer.path = path
            rectLayer.addAnimation(animation, forKey: "path")
            
            animation = CABasicAnimation(keyPath: "path")
            
            animation.duration = 1.0
            animation.fromValue = triangleLayer.path
            animation.toValue = triangle.path().CGPath
            triangleLayer.path = triangle.path().CGPath
            triangleLayer.addAnimation(animation, forKey: "path")
            
            self.setNeedsDisplay()
        }
    }
}