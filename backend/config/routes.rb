Rails.application.routes.draw do
  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      post "evidence/presign", to: "evidence#presign"
      resources :evidence, only: :show
      match "evidence", to: "evidence#get_not_allowed", via: %i[get]
      match "evidence", to: "evidence#read_only", via: %i[post put patch delete]
      match "evidence/:id", to: "evidence#read_only", via: %i[post put patch delete]
      resources :violations, only: %i[index show create] do
        get :evidence, on: :member
      end
      get "violations/:id/audit-log", to: "violation_audit_logs#for_violation"
      get "audit-log", to: "violation_audit_logs#index"
    end
  end
end
