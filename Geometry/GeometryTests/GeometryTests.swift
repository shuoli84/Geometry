//
//  GeometryTests.swift
//  GeometryTests
//
//  Created by LiShuo on 7/23/15.
//  Copyright (c) 2015 LiShuo. All rights reserved.
//

import UIKit
import XCTest
import Geometry

class GeometryTests: XCTestCase {
    // a b c d
    // e f g h
    // i j k l
    // m n o p
    let a = CGPointMake(0, 0)
    let b = CGPointMake(10, 0)
    let c = CGPointMake(20, 0)
    let d = CGPointMake(30, 0)
    let e = CGPointMake(0, 10)
    let f = CGPointMake(10, 10)
    let g = CGPointMake(20, 10)
    let h = CGPointMake(30, 10)
    let i = CGPointMake(0, 20)
    let j = CGPointMake(10, 20)
    let k = CGPointMake(20, 20)
    let l = CGPointMake(30, 20)
    let m = CGPointMake(0, 30)
    let n = CGPointMake(10, 30)
    let o = CGPointMake(20, 30)
    let p = CGPointMake(30, 30)
    
    func testPoint() {
        println("\(c.pointByRotateAroundOrigin(CGFloat(M_PI_2)).rounded(unit: 0.1))")
        var point = c.pointByRotate(b, angle: CGFloat(M_PI_2))
        XCTAssertEqual(point, f)
    }
    
    func testSegment() {
        var s = Segment(p1: CGPointMake(0, 0), p2: CGPointMake(10, 0))
        XCTAssertEqual(s.project(CGPointMake(0, 10)), CGPointMake(0, 0))
        
        XCTAssertEqual(s.project(CGPointMake(5, 5)), CGPointMake(5, 0))
        
        s = Segment(p1: CGPointMake(0, 0), p2: CGPointMake(20, 20))
        XCTAssertEqual(s.project(CGPointMake(0, 5)), CGPointMake(2.5, 2.5))
        
        XCTAssert(s.contains(CGPointMake(5, 5)))
        XCTAssert(!s.contains(CGPointMake(5, 6)))
        XCTAssert(!Segment(p1: CGPointMake(10, 10), p2: CGPointMake(20, 20)).contains(CGPointMake(0, 0)))
        
        // a b c d
        // e f g h
        // i j k l
        // m n o p
       
        let am = Segment(p1:a, p2:m)
        let dp = Segment(p1:d, p2:p)
        
        XCTAssert(am.crossPoint(dp) == nil)
        
        let ck = Segment(p1:c, p2:k)
        XCTAssert(am.crossPoint(ck) == nil)
        
        let eo = Segment(p1:e, p2:o)
        let dm = Segment(p1:d, p2:m)
        XCTAssertEqual(eo.crossPoint(dm)!, j)
        
        let ad = Segment(p1:a, p2:d)
        XCTAssertEqual(am.pointByDistance(10), e)
        XCTAssertEqual(ad.pointByDistance(10), b)
        
        ad.split(c, startFromPoint: true).map { (item: Segment) in
            XCTAssertEqual(item.p1, self.c)
        }
        
        XCTAssertEqual(ad.angle, 0)
        XCTAssertEqual(eo.angle, CGFloat(M_PI_4))
        
        let oe = Segment(p1: o, p2: e)
        XCTAssertEqual(oe.angle, -CGFloat(M_PI_4 * 3))
        
        XCTAssert(oe.segmentByRotate(o, angle: CGFloat(M_PI_4)).contains(k))
    }
    
    func testRect() {
        let rect = CGRectMake(10, 10, 10, 10)
        
        XCTAssert(rect.project(CGPointMake(0, 0)) == nil)
        XCTAssert(rect.project(CGPointMake(30, 0)) == nil)
        XCTAssert(rect.project(CGPointMake(0, 30)) == nil)
        XCTAssert(rect.project(CGPointMake(30, 30)) == nil)
        
        XCTAssertEqual(rect.project(rect.topLeft)!, rect.topLeft)
        XCTAssertEqual(rect.project(rect.bottomLeft)!, rect.bottomLeft)
        XCTAssertEqual(rect.project(rect.topRight)!, rect.topRight)
        XCTAssertEqual(rect.project(rect.bottomRight)!, rect.bottomRight)
        
        XCTAssertEqual(rect.project(CGPointMake(15, 0))!, CGPointMake(15, 10))
        XCTAssertEqual(rect.project(CGPointMake(0, 15))!, CGPointMake(10, 15))
        XCTAssertEqual(rect.project(CGPointMake(30, 15))!, CGPointMake(20, 15))
        XCTAssertEqual(rect.project(CGPointMake(15, 30))!, CGPointMake(15, 20))
        
        XCTAssertEqual(rect.closestPointTo(CGPointMake(0, 0)), CGPointMake(10, 10))
        XCTAssertEqual(rect.closestPointTo(CGPointMake(30, 0)), CGPointMake(20, 10))
        XCTAssertEqual(rect.closestPointTo(CGPointMake(0, 30)), CGPointMake(10, 20))
        XCTAssertEqual(rect.closestPointTo(CGPointMake(30, 30)), CGPointMake(20, 20))
    }
    
    func testTriangle() {
        // a b c d
        // e f g h
        // i j k l
        // m n o p
        
        let t = Triangle(p1: a, p2: i, p3: h)
        println("\([a.distance(i), i.distance(h), h.distance(a))")
        println("\(t.perimeter)")
        XCTAssertTrue(abs(t.area - 300) < 0.000001)
    }
    
    func testBubbleTail() {
        // a b c d
        // e f g h
        // i j k l
        // m n o p
     
        println("\(bubbleTailSegment(CGRectMake(10, 10, 10, 10), a, 5))")
        println("\(bubbleTailSegment(CGRectMake(10, 10, 10, 10), b, 5))")
        println("\(bubbleTailSegment(CGRectMake(10, 10, 10, 10), c, 5))")
        println("\(bubbleTailSegment(CGRectMake(10, 10, 10, 10), d, 5))")
        println("\(bubbleTailSegment(CGRectMake(10, 10, 10, 10), h, 5))")
        
        println("*****************************************************")
        println("*****************************************************")
        println("*****************************************************")
        
        println("\(tailTriangleForBubble(CGRectMake(10, 10, 10, 10), a, 3))")
        println("\(tailTriangleForBubble(CGRectMake(10, 10, 10, 10), b, 3))")
        println("\(tailTriangleForBubble(CGRectMake(10, 10, 10, 10), c, 3))")
        println("\(tailTriangleForBubble(CGRectMake(10, 10, 10, 10), d, 3))")
        println("\(tailTriangleForBubble(CGRectMake(10, 10, 10, 10), h, 3))")
        println("\(tailTriangleForBubble(CGRectMake(10, 10, 10, 10), CGPointMake(0, 15), 3))")
    }
    
    func testCGFloat() {
        XCTAssertEqual(CGFloat(1.234).roundedTo(0.5), 1)
        XCTAssertEqual(CGFloat(1.234).roundedTo(0.25), 1.25)
    }
    
    func testCircle() {
        var circle = Circle(center: CGPointMake(5, 5), radius: 5)
        var points = circle.pointsSplitedEvenly(4)
        
        XCTAssertEqual(points.count, 4)
        XCTAssertEqual(points[0], CGPointMake(10, 5))
        XCTAssertEqual(points[1], CGPointMake(5, 10))
        
        points = circle.pointsSplitedEvenly(4, startAngle: CGFloat(-M_PI_2))
        
        XCTAssertEqual(points[0], CGPointMake(5, 0))
        XCTAssertEqual(points[1], CGPointMake(10, 5))
      
        points = circle.pointsSplitedEvenly(4, startAngle: CGFloat(-M_PI_2), clockWise: false)
        
        XCTAssertEqual(points[0], CGPointMake(5, 0))
        XCTAssertEqual(points[1].rounded(), CGPointMake(0, 5))
        
        var point = circle.closestPointTo(CGPointMake(0, 0)).rounded(unit: 0.01)
        XCTAssertEqual(point, CGPointMake(1.46, 1.46))
        
        XCTAssertEqual(circle.closestPointTo(CGPointMake(0, 5)).rounded(), CGPointMake(0, 5))
    }
    
    func testArc() {
        var circle = Circle(center: CGPointMake(5, 5), radius: 5)
        var arc = Arc(circle: circle, start: 0, end: CGFloat(M_PI_4), clockwise: true)
        
        XCTAssertEqual(arc.closestPointTo(CGPointMake(6, 5)), CGPointMake(10, 5))
        
        var pie = Pie(arc: arc)
        XCTAssertEqual(pie.cloestPoint(CGPointMake(6, 5)), CGPointMake(6, 5))
    }
    
    func testAngle() {
        XCTAssertEqual(angleNormalizeToZeroToTwoPI(CGFloat(-M_PI * 7.0 / 4.0)), CGFloat(M_PI / 4))
        XCTAssertEqual(angleNormalizeToZeroToTwoPI(CGFloat(M_PI / 4.0)), CGFloat(M_PI / 4))
        
        XCTAssert(angleBetweenAngles(0, CGFloat(-M_PI / 4), CGFloat(M_PI / 4), true))
        XCTAssertFalse(angleBetweenAngles(0, CGFloat(M_PI / 4), CGFloat(-M_PI / 4), true))
        
        XCTAssertFalse(angleBetweenAngles(0, CGFloat(-M_PI / 4), CGFloat(M_PI / 4), false))
        XCTAssert(angleBetweenAngles(0, CGFloat(M_PI / 4), CGFloat(-M_PI / 4), false))
        
        XCTAssert(angleBetweenAngles(0, CGFloat(-M_PI * 9 / 4), CGFloat(M_PI / 4), true))
        XCTAssertFalse(angleBetweenAngles(0, CGFloat(M_PI * 9 / 4), CGFloat(-M_PI / 4), true))
        
        XCTAssertFalse(angleBetweenAngles(0, CGFloat(-M_PI * 9 / 4), CGFloat(M_PI / 4), false))
        XCTAssert(angleBetweenAngles(0, CGFloat(M_PI * 9 / 4), CGFloat(-M_PI / 4), false))
    }
}