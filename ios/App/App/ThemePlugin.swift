import Foundation
import UIKit
import Capacitor
import WebKit

@objc(ThemePlugin)
public class ThemePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ThemePlugin"
    public let jsName = "Theme"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setDarkMode", returnType: CAPPluginReturnPromise)
    ]

    private let lightColor = UIColor(red: 250/255, green: 247/255, blue: 242/255, alpha: 1.0) // #faf7f2
    private let darkColor = UIColor(red: 26/255, green: 26/255, blue: 26/255, alpha: 1.0)     // #1a1a1a

    public override func load() {
        print("[ThemePlugin] Plugin loaded!")
    }

    @objc func setDarkMode(_ call: CAPPluginCall) {
        let isDark = call.getBool("isDark") ?? false
        print("[ThemePlugin] setDarkMode called with isDark: \(isDark)")

        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.resolve()
                return
            }

            let targetColor = isDark ? self.darkColor : self.lightColor

            // Get window
            var window = self.bridge?.viewController?.view.window
            if window == nil {
                window = UIApplication.shared.connectedScenes
                    .compactMap { $0 as? UIWindowScene }
                    .flatMap { $0.windows }
                    .first { $0.isKeyWindow }
            }
            if window == nil {
                window = UIApplication.shared.connectedScenes
                    .compactMap { $0 as? UIWindowScene }
                    .flatMap { $0.windows }
                    .first
            }

            guard let window = window else {
                print("[ThemePlugin] No window found!")
                call.resolve()
                return
            }

            // Set user interface style override
            window.overrideUserInterfaceStyle = isDark ? .dark : .light
            print("[ThemePlugin] Set overrideUserInterfaceStyle")

            // Set window background
            window.backgroundColor = targetColor
            print("[ThemePlugin] Set window background")

            // Set root view controller's view
            if let rootVC = window.rootViewController {
                rootVC.view.backgroundColor = targetColor
                print("[ThemePlugin] Set rootVC background")

                // Recursively set all child view controllers
                self.setBackgroundForViewControllerHierarchy(rootVC, color: targetColor)
            }

            // Set Capacitor bridge view controller
            if let bridgeVC = self.bridge?.viewController {
                bridgeVC.view.backgroundColor = targetColor
                print("[ThemePlugin] Set bridgeVC background")
            }

            // Set webview backgrounds
            if let webView = self.bridge?.webView {
                webView.isOpaque = false
                webView.backgroundColor = targetColor
                webView.scrollView.backgroundColor = targetColor

                // Ensure content extends under safe areas
                webView.scrollView.contentInsetAdjustmentBehavior = .never

                // Set all scroll view subviews
                self.setBackgroundForScrollViewSubviews(webView.scrollView, color: targetColor)
                print("[ThemePlugin] Set webView backgrounds")
            }

            // Also set the superview backgrounds to catch safe area insets
            if let webViewSuper = self.bridge?.webView?.superview {
                webViewSuper.backgroundColor = targetColor
                webViewSuper.superview?.backgroundColor = targetColor
                print("[ThemePlugin] Set webView superview backgrounds")
            }

            print("[ThemePlugin] All backgrounds set to \(isDark ? "dark" : "light")")
        }

        call.resolve()
    }

    private func setBackgroundForViewControllerHierarchy(_ vc: UIViewController, color: UIColor) {
        vc.view.backgroundColor = color
        for child in vc.children {
            setBackgroundForViewControllerHierarchy(child, color: color)
        }
    }

    private func setBackgroundForScrollViewSubviews(_ scrollView: UIScrollView, color: UIColor) {
        scrollView.backgroundColor = color

        for subview in scrollView.subviews {
            // Don't change image views (might be scroll indicators)
            if subview is UIImageView {
                continue
            }

            // For WKContentView and similar, set to clear so parent shows through
            // But for the actual content, we want the background
            if let className = NSClassFromString("WKContentView"), subview.isKind(of: className) {
                subview.backgroundColor = .clear
            } else if let className = NSClassFromString("WKChildScrollView"), subview.isKind(of: className) {
                subview.backgroundColor = color
            } else {
                // For other views, set to the target color
                subview.backgroundColor = color
            }
        }
    }
}
