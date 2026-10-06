Rails.application.routes.draw do
  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Handle OPTIONS preflight requests in development
  match '*path', to: 'application#cors_preflight_check', via: :options

  namespace :api do
    namespace :v1 do
      post "auth/login", to: "auth#login"
      get "auth/me", to: "auth#me"
      post "auth/change-password", to: "auth#change_password"

      resources :cameras, only: %i[index show create update]
      get "cameras/:camera_id/signal", to: "camera_signals#show"
      put "cameras/:camera_id/signal", to: "camera_signals#update"
      get "cameras/:camera_id/config", to: "camera_configs#show"
      put "cameras/:camera_id/config", to: "camera_configs#update"
      post "cameras/:camera_id/heartbeat", to: "worker_heartbeats#create"
      get "worker-manager/cameras", to: "worker_manager#index"
      post "worker-manager/cameras/:camera_id/claim", to: "worker_manager#claim"
      post "worker-manager/cameras/:camera_id/failure", to: "worker_manager#failure"
      resources :officers, only: %i[index show create update destroy]

      resources :violations, only: %i[index show create] do
        member do
          get :evidence
          post :confirm, to: "violation_reviews#confirm"
          post :reject, to: "violation_reviews#reject"
          post :reopen, to: "violation_reviews#reopen"
          post :notes, to: "violation_reviews#notes"
          get "audit-log", to: "violation_audit_logs#for_violation", as: :audit_log
        end
      end

      post "evidence/presign", to: "evidence#presign"
      resources :evidence, only: :show
      match "evidence", to: "evidence#get_not_allowed", via: %i[get]
      match "evidence", to: "evidence#read_only", via: %i[post put patch delete]
      match "evidence/:id", to: "evidence#read_only", via: %i[post put patch delete]

      get "violations/:id/audit-log", to: "violation_audit_logs#for_violation"
      get "audit-log", to: "violation_audit_logs#index", as: :audit_log
    end
  end
end
