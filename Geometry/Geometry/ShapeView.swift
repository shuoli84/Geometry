import Foundation
import UIKit


class ShapeView: UIView {
    var path: UIBezierPath? {
        didSet {
            if let path = path {
                shapeLayer.path = path.CGPath
            }
        }
    }
    
    var shapeLayer: CAShapeLayer = CAShapeLayer()
    var fillColor: UIColor? {
        didSet {
            shapeLayer.fillColor = fillColor?.CGColor
        }
    }
    
    var strokeColor: UIColor? {
        didSet {
            shapeLayer.strokeColor = strokeColor?.CGColor
        }
    }
    
    required init(coder aDecoder: NSCoder) {
        super.init(coder: aDecoder)
        
        self.layer.addSublayer(shapeLayer)
    }
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        
        self.layer.addSublayer(shapeLayer)
    }
}