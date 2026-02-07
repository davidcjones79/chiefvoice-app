import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    // Colors used throughout the app
    static let lightColor = UIColor(red: 250/255, green: 247/255, blue: 242/255, alpha: 1.0) // #faf7f2
    static let darkColor = UIColor(red: 26/255, green: 26/255, blue: 26/255, alpha: 1.0)     // #1a1a1a

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Start with light background (JS will update it when theme is determined)
        if let window = self.window {
            window.backgroundColor = AppDelegate.lightColor

            // Set root view controller background
            if let rootVC = window.rootViewController {
                rootVC.view.backgroundColor = AppDelegate.lightColor

                // Set all child views
                for subview in rootVC.view.subviews {
                    subview.backgroundColor = AppDelegate.lightColor
                }
            }
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
