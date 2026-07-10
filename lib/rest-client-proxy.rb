# frozen_string_literal: true

module CaptureRestClientProxy
  def self.install_bundler_hook
    return unless defined?(Bundler)
    return if Bundler.singleton_class.method_defined?(:capture_original_setup)

    Bundler.singleton_class.class_eval do
      alias capture_original_setup setup

      define_method(:setup) do |*groups|
        result = capture_original_setup(*groups)
        Kernel.send(:require, 'rest-client')
        RestClient.proxy = ENV.fetch('VPSADMIN_CAPTURE_HTTP_PROXY')
        result
      end
    end
  end
end

module Kernel
  alias capture_original_require require

  def require(feature)
    loaded = capture_original_require(feature)
    CaptureRestClientProxy.install_bundler_hook if feature == 'bundler'
    loaded
  end

  private :require
end

CaptureRestClientProxy.install_bundler_hook
