import Foundation
import UIKit


class StarViewController: UIViewController {
    @IBOutlet weak var shapeView: ShapeView!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        shapeView.fillColor = UIColor.redColor()
        shapeView.strokeColor = UIColor.cyanColor()
    }
    
    @IBAction func pan(sender: UIGestureRecognizer) {
        let location = sender.locationInView(shapeView)
        let center = shapeView.bounds.center
        
        let circle = Circle(center: center, radius: Segment(p1: center, p2: location).length * 0.6)
        let points = circle.pointsSplitedEvenly(5, startAngle: Segment(p1: center, p2: location).angle, clockWise: true)
        let step = 2
        
        let orderedPoints = points.indices.map {points[$0 * step % points.count]}
        
        shapeView.path = UIBezierPath.poligonByPoints(orderedPoints)
    }
}